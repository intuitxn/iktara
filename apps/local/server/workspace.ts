/// <reference types="bun" />
import { Database } from "bun:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { ChatInput } from "./prompts.js";
import type { WorldID } from "./worlds.js";
import type { Domain, EvidenceBundle, Method } from "./evidence.js";

export type Profile = {
  username?: string;
  location?: { latitude: number; longitude: number; timezone: string; display_name: string };
  name: string;
  date_of_birth: string;
  time_of_birth: string | null;
  birthplace: string;
  birth_time_quality: "exact" | "approximate" | "unknown";
};
export type ChartResult = {
  chart: Record<string, unknown>;
  display_name: string;
  timezone: string;
  [key: string]: unknown;
};
export type Message = {
  id: string;
  page: WorldID;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  jobId: string;
  evidence?: EvidenceBundle;
  method?: Method;
  domain?: Domain;
};
export type Job = {
  id: string;
  page: WorldID;
  status: "pending" | "running" | "completed" | "error";
  createdAt: number;
  updatedAt: number;
  text: string | null;
  error: string | null;
  evidence?: EvidenceBundle;
  method?: Method;
  domain?: Domain;
};
export type ClaimedJob = Job & {
  owner: string;
  input: ChatInput;
  runToken: string;
};
type UserRow = { profile: string | null; chart: string | null };
type JobRow = Job & {
  owner: string;
  input: string;
  runToken: string | null;
  attempts: number;
};
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const jobColumns =
  "id, page, status, created_at AS createdAt, updated_at AS updatedAt, output AS text, error";
export const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;

export class WorkspaceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Every data lookup is scoped to the server-resolved owner, never a body ID. */
export class WorkspaceStore {
  readonly db: Database;
  constructor(filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new Database(filename, { create: true, strict: true });
    this.db.exec(`
      PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY, profile TEXT, chart TEXT, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS handles (owner TEXT PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE, username TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS browser_sessions (
        token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        page TEXT NOT NULL, request_id TEXT NOT NULL, status TEXT NOT NULL,
        input TEXT NOT NULL, output TEXT, error TEXT, run_token TEXT, attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(owner, request_id)
      );
      CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner, created_at);
      CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, created_at);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        page TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        UNIQUE(job_id, role)
      );
      CREATE INDEX IF NOT EXISTS messages_owner_page ON messages(owner, page, created_at);
      CREATE TABLE IF NOT EXISTS reading_jobs (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
        owner TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        method TEXT NOT NULL, domain TEXT NOT NULL, evidence TEXT
      );
    `);
  }

  createIdentity(now = Date.now()): { owner: string; token: string } {
    const owner = randomUUID();
    const token = randomBytes(32).toString("base64url");
    this.db.transaction(() => {
      this.db
        .query("INSERT INTO people(id,created_at) VALUES(?,?)")
        .run(owner, now);
      this.db
        .query(
          "INSERT INTO browser_sessions(token_hash,owner,expires_at) VALUES(?,?,?)",
        )
        .run(tokenHash(token), owner, now + SESSION_AGE_SECONDS * 1000);
    })();
    return { owner, token };
  }

  resolveIdentity(
    token: string | undefined,
    now = Date.now(),
  ): string | undefined {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    const row = this.db
      .query<{ owner: string }, [string, number]>(
        "SELECT owner FROM browser_sessions WHERE token_hash=? AND expires_at>?",
      )
      .get(tokenHash(token), now);
    return row?.owner;
  }

  workspace(owner: string) {
    const row = this.db
      .query<UserRow, [string]>("SELECT profile,chart FROM people WHERE id=?")
      .get(owner);
    if (!row)
      throw new WorkspaceError(401, "Open your workspace again to continue.");
    return {
      profile: row.profile ? { ...(JSON.parse(row.profile) as Profile), ...this.handle(owner) } : null,
      chart: row.chart ? (JSON.parse(row.chart) as ChartResult) : null,
      messages: this.db
        .query<Message, [string]>(
          "SELECT id,page,role,content,created_at AS createdAt,job_id AS jobId FROM messages WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT 100",
        )
        .all(owner).map(message => ({ ...message, ...this.reading(owner, message.jobId, message.role === "assistant") })),
      jobs: this.db
        .query<Job, [string]>(
          `SELECT ${jobColumns} FROM jobs WHERE owner=? ORDER BY created_at DESC LIMIT 30`,
        )
        .all(owner).map(job => ({ ...job, ...this.reading(owner, job.id) })),
    };
  }

  private handle(owner: string): { username?: string } {
    return this.db.query<{username:string}, [string]>("SELECT username FROM handles WHERE owner=?").get(owner) || {};
  }

  saveProfile(
    owner: string,
    profile: Profile | null,
    chart?: ChartResult | null,
  ) {
    this.db.transaction(() => {
    if (profile && (profile.username || chart)) {
      const username = profile.username || this.handle(owner).username || `stargazer-${randomBytes(5).toString("hex")}`;
      if (!/^[a-z][a-z0-9-]{2,29}$/.test(username)) throw new WorkspaceError(400, "Use 3–30 lowercase letters, numbers or hyphens for your username.");
      const used = this.db.query<{owner:string},[string]>("SELECT owner FROM handles WHERE username=?").get(username);
      if (used && used.owner !== owner) throw new WorkspaceError(409, "That username is taken. Choose another.");
      this.db.query("INSERT INTO handles(owner,username) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET username=excluded.username").run(owner, username);
      profile = { ...profile, username };
    }
    // A changed birth profile invalidates the old chart. Charts only come from compute.
    const old = this.db
      .query<UserRow, [string]>("SELECT profile,chart FROM people WHERE id=?")
      .get(owner);
    const encoded = profile ? JSON.stringify(profile) : null;
    const calculationKey = (value: Profile | null) => value ? JSON.stringify({date:value.date_of_birth,time:value.time_of_birth,quality:value.birth_time_quality,place:value.birthplace,location:value.location}) : null;
    const chartJson =
      chart === undefined && calculationKey(old?.profile ? JSON.parse(old.profile) : null) === calculationKey(profile)
        ? old?.chart ?? null
        : chart
          ? JSON.stringify(chart)
          : null;
    this.db
      .query("UPDATE people SET profile=?,chart=? WHERE id=?")
      .run(encoded, chartJson, owner);
    })();
  }

  reset(owner: string) {
    this.db.transaction(() => {
      this.db.query("DELETE FROM jobs WHERE owner=?").run(owner);
      this.db.query("DELETE FROM handles WHERE owner=?").run(owner);
      this.db
        .query("UPDATE people SET profile=NULL,chart=NULL WHERE id=?")
        .run(owner);
    })();
  }

  getJob(owner: string, id: string): Job | null {
    const job = this.db
      .query<Job, [string, string]>(
        `SELECT ${jobColumns} FROM jobs WHERE owner=? AND id=?`,
      )
      .get(owner, id);
    return job ? { ...job, ...this.reading(owner, id) } : null;
  }

  private reading(owner: string, id: string, includeEvidence = true) {
    const row = this.db.query<{ method: Method; domain: Domain; evidence: string | null }, [string, string]>(
      "SELECT method,domain,evidence FROM reading_jobs WHERE owner=? AND job_id=?",
    ).get(owner, id);
    return row ? { method: row.method, domain: row.domain, ...(includeEvidence && row.evidence ? { evidence: JSON.parse(row.evidence) as EvidenceBundle } : {}) } : {};
  }

  enqueue(
    owner: string,
    page: WorldID,
    message: string,
    requestId: string,
    method: Method = "compare",
    domain: Domain = "general",
  ): Job {
    return this.db.transaction(() => {
      const existing = this.db
        .query<Job, [string, string]>(
          `SELECT ${jobColumns} FROM jobs WHERE owner=? AND request_id=?`,
        )
        .get(owner, requestId);
      if (existing) return existing;
      const inPage = this.db
        .query<{ count: number }, [string, string]>(
          "SELECT COUNT(*) AS count FROM jobs WHERE owner=? AND page=? AND status IN ('pending','running')",
        )
        .get(owner, page)!.count;
      if (inPage)
        throw new WorkspaceError(
          409,
          "Your companion is still finishing the previous question in this space.",
        );
      const active = this.db
        .query<{ count: number }, [string]>(
          "SELECT COUNT(*) AS count FROM jobs WHERE owner=? AND status IN ('pending','running')",
        )
        .get(owner)!.count;
      if (active >= 2)
        throw new WorkspaceError(
          429,
          "Your agents are already working on two questions. Please wait for a reply.",
        );
      const queued = this.db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('pending','running')",
        )
        .get()!.count;
      if (queued >= 50)
        throw new WorkspaceError(
          429,
          "Iktara is busy. Please try again shortly.",
        );
      const current = this.workspace(owner);
      if (page === "chart") {
        // A reading lens runs the original engines against the saved chart,
        // so both the birth details and the calculated chart must exist.
        if (!current.profile)
          throw new WorkspaceError(409, "Save your birth details first.");
        if (!current.chart)
          throw new WorkspaceError(
            409,
            "Calculate your birth chart first, then ask your question.",
          );
      }
      // Workspace messages are newest-first; keep the model history chronological.
      const history = current.messages
        .filter((item) => item.page === page)
        .slice(0, 20)
        .reverse()
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, 8000),
        }));
      const input: ChatInput = {
        message,
        profile: current.profile,
        chart: current.chart?.chart,
        history,
        page,
        method,
        domain,
        calculationInputs: current.profile ? {
          date_of_birth: current.profile.date_of_birth,
          time_of_birth: current.profile.time_of_birth,
          birth_time_quality: current.profile.birth_time_quality,
          latitude: current.chart?.latitude,
          longitude: current.chart?.longitude,
          timezone: current.chart?.timezone,
        } : undefined,
      };
      const id = randomUUID();
      const now = Date.now();
      this.db
        .query(
          "INSERT INTO jobs(id,owner,page,request_id,status,input,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?)",
        )
        .run(id, owner, page, requestId, JSON.stringify(input), now, now);
      if (page === "chart") this.db.query("INSERT INTO reading_jobs(job_id,owner,method,domain) VALUES(?,?,?,?)").run(id, owner, method, domain);
      this.db
        .query(
          "INSERT INTO messages(id,owner,page,role,content,created_at,job_id) VALUES(?,?,?,'user',?,?,?)",
        )
        .run(randomUUID(), owner, page, message, now, id);
      return this.getJob(owner, id)!;
    })();
  }

  recoverInterrupted() {
    // Never replay paid inference implicitly after a crash. Queued jobs remain queued.
    this.db
      .query(
        "UPDATE jobs SET status='error',error='This response was interrupted when the service restarted. Please try again.',input='{}',run_token=NULL,updated_at=? WHERE status='running'",
      )
      .run(Date.now());
  }

  claim(): ClaimedJob | undefined {
    return this.db.transaction(() => {
      const row = this.db
        .query<JobRow, []>(
          `SELECT ${jobColumns},owner,input,run_token AS runToken,attempts FROM jobs WHERE status='pending' ORDER BY created_at,rowid LIMIT 1`,
        )
        .get();
      if (!row) return;
      const runToken = randomUUID();
      this.db
        .query(
          "UPDATE jobs SET status='running',attempts=attempts+1,run_token=?,updated_at=? WHERE id=? AND status='pending'",
        )
        .run(runToken, Date.now(), row.id);
      return {
        ...row,
        status: "running" as const,
        runToken,
        input: JSON.parse(row.input) as ChatInput,
      };
    })();
  }

  complete(job: ClaimedJob, text: string) {
    this.db.transaction(() => {
      const now = Date.now();
      const result = this.db
        .query(
          "UPDATE jobs SET status='completed',output=?,input='{}',updated_at=? WHERE id=? AND owner=? AND status='running' AND run_token=?",
        )
        .run(text, now, job.id, job.owner, job.runToken);
      if (!result.changes) return; // Deleted/reset or superseded while the model ran.
      if (job.input.evidence)
        this.db.query("UPDATE reading_jobs SET evidence=? WHERE job_id=? AND owner=?").run(JSON.stringify(job.input.evidence), job.id, job.owner);
      this.db
        .query(
          "INSERT INTO messages(id,owner,page,role,content,created_at,job_id) VALUES(?,?,?,'assistant',?,?,?)",
        )
        .run(randomUUID(), job.owner, job.page, text, now, job.id);
    })();
  }

  fail(job: ClaimedJob, error: string) {
    this.db
      .query(
        "UPDATE jobs SET status='error',error=?,input='{}',updated_at=? WHERE id=? AND owner=? AND status='running' AND run_token=?",
      )
      .run(error, Date.now(), job.id, job.owner, job.runToken);
  }
  close() {
    this.db.close();
  }
}
