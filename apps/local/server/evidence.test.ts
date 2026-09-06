import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { prepareEvidence, checkEvidenceReferences, type EvidenceBundle } from "./evidence.js";
import type { ChatInput } from "./prompts.js";
import { WorkspaceStore } from "./workspace.js";
import { JobWorker } from "./jobs.js";

const evidence: EvidenceBundle = { id: "reading-synthetic", schema_version: "iktara-evidence-v1", method: "western", domain: "career", engine_revision: "fixture", chart_digest: "fixture", birth_time_quality: "exact", items: [{ id: "E-0123456789abcdef", system: "western", kind: "pattern", detail: "Synthetic only" }], limitations: ["Synthetic fixture, not a calculation."] };

test("local evidence contract binds frozen inputs, rejects redirection and validates output", async () => {
  const input: ChatInput = { message: "Synthetic question", page: "chart", method: "western", domain: "career", chart: { synthetic: true } };
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "http://127.0.0.1:8001/v1/evidence/extract");
    assert.equal(init?.redirect, "error");
    assert.deepEqual(JSON.parse(String(init?.body)), { chart: input.chart, query: input.message, method: "western", domain: "career" });
    return Response.json(evidence);
  };
  await prepareEvidence(input, new URL("http://127.0.0.1:8001/ignored"), "synthetic", request as typeof fetch);
  assert.equal(input.evidence?.id, evidence.id);
  await assert.rejects(prepareEvidence(input, new URL("https://external.example"), "synthetic"), /local HTTP/);
  await assert.rejects(prepareEvidence({ ...input, chart: null }, new URL("http://127.0.0.1:8001"), "synthetic"), /Calculate/);
  await assert.rejects(prepareEvidence(input, new URL("http://127.0.0.1:8001"), "synthetic", async () => Response.json({ ...evidence, method: "kp" })), /unavailable/);
  assert.doesNotThrow(() => checkEvidenceReferences("A symbolic pattern [E-0123456789abcdef]", evidence));
  assert.throws(() => checkEvidenceReferences("No source", evidence));
  assert.throws(() => checkEvidenceReferences("Invented [E-ffffffffffffffff]", evidence));
});

test("readings survive reload, remain owner scoped and clear cascades; ungrounded output fails", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iktara-reading-test-"));
  const filename = path.join(root, "test.sqlite");
  let store = new WorkspaceStore(filename);
  try {
    const a = store.createIdentity(), b = store.createIdentity();
    assert.throws(() => store.enqueue(a.owner, "chart", "Question", "empty"), /Calculate/);
    store.saveProfile(a.owner, { name: "Synthetic", date_of_birth: "2000-01-01", time_of_birth: "12:00", birthplace: "New Delhi", birth_time_quality: "exact" }, { chart: { synthetic: true }, latitude: 28.61, longitude: 77.21, timezone: "Asia/Kolkata", display_name: "Synthetic" });
    const job = store.enqueue(a.owner, "chart", "Question", "first", "western", "career");
    const worker = new JobWorker(store, async input => {
      input.evidence = evidence;
      return "A symbolic pattern [E-0123456789abcdef]";
    });
    worker.wake();
    for (let i = 0; i < 40 && store.getJob(a.owner, job.id)?.status !== "completed"; i++) await new Promise(resolve => setTimeout(resolve, 5));
    await worker.stop();
    store.close(); store = new WorkspaceStore(filename);
    assert.deepEqual(store.workspace(a.owner).messages.at(-1)?.evidence, evidence);
    assert.equal(store.workspace(a.owner).messages[0]?.method, "western");
    assert.equal(store.getJob(b.owner, job.id), null);
    assert.deepEqual(store.workspace(b.owner).messages, []);
    const followup = store.enqueue(a.owner, "chart", "And relationships?", "second", "kp", "relationships");
    const bad = new JobWorker(store, async input => { input.evidence = evidence; return "Unsupported claim [E-ffffffffffffffff]"; });
    bad.wake();
    for (let i = 0; i < 40 && store.getJob(a.owner, followup.id)?.status !== "error"; i++) await new Promise(resolve => setTimeout(resolve, 5));
    await bad.stop();
    assert.equal(store.getJob(a.owner, followup.id)?.status, "error");
    assert.equal(store.workspace(a.owner).messages.filter(m => m.role === "assistant").length, 1);
    store.reset(a.owner);
    assert.equal(store.db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM reading_jobs").get()?.n, 0);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});
