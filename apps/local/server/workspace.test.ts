import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorkspaceStore, type Profile } from "./workspace.js";
import { JobWorker } from "./jobs.js";
import type { EvidenceBundle } from "./evidence.js";

const profile: Profile = {
  name: "Synthetic A",
  date_of_birth: "2000-01-01",
  time_of_birth: null,
  birthplace: "New Delhi",
  birth_time_quality: "unknown",
};

test("two browser identities never share profile, chart, conversation, or job results", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iktara-ownership-test-"));
  const store = new WorkspaceStore(path.join(root, "test.sqlite"));
  try {
    const a = store.createIdentity();
    const b = store.createIdentity();
    assert.notEqual(a.owner, b.owner);
    assert.notEqual(a.owner, a.token);
    assert.equal(store.resolveIdentity(a.token), a.owner);
    assert.equal(store.resolveIdentity(a.owner), undefined);
    assert.equal(
      store.resolveIdentity(a.token, Date.now() + 31 * 86400000),
      undefined,
    );
    store.saveProfile(a.owner, profile, {
      chart: { synthetic: "A chart only" },
      display_name: "New Delhi",
      timezone: "Asia/Kolkata",
    });
    store.saveProfile(b.owner, { ...profile, name: "Synthetic B" });
    const job = store.enqueue(
      a.owner,
      "reflection",
      "A private question",
      "request-a",
    );
    assert.equal(store.getJob(b.owner, job.id), null);
    const claimed = store.claim()!;
    assert.equal(claimed.input.profile?.name, "Synthetic A");
    assert.equal(claimed.input.chart?.synthetic, "A chart only");
    store.complete(claimed, "A private answer");
    assert.equal(store.getJob(a.owner, job.id)?.status, "completed");
    assert.equal(store.getJob(b.owner, job.id), null);
    assert.deepEqual(store.workspace(b.owner).messages, []);
    assert.equal(store.workspace(b.owner).chart, null);
    assert.equal(store.workspace(b.owner).profile?.name, "Synthetic B");
    assert.equal(
      store.workspace(a.owner).messages.at(-1)?.content,
      "A private answer",
    );
    const next = store.enqueue(
      a.owner,
      "chart",
      "A chart question",
      "request-chart",
    );
    const chartJob = store.claim()!;
    assert.equal(chartJob.id, next.id);
    assert.deepEqual(
      chartJob.input.history,
      [],
      "each page has separate conversation context",
    );
    store.reset(a.owner);
    store.complete(chartJob, "Late response must not recreate deleted data");
    assert.equal(store.workspace(a.owner).profile, null);
    assert.deepEqual(store.workspace(a.owner).messages, []);
    assert.equal(store.workspace(b.owner).profile?.name, "Synthetic B");
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("durable queue recovers pending jobs, fails interrupted inference, and deduplicates requests", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iktara-jobs-test-"));
  const filename = path.join(root, "test.sqlite");
  let store = new WorkspaceStore(filename);
  try {
    const { owner } = store.createIdentity();
    const running = store.enqueue(
      owner,
      "reflection",
      "First question",
      "first",
    );
    assert.equal(
      store.enqueue(owner, "reflection", "First question", "first").id,
      running.id,
    );
    store.claim();
    store.saveProfile(owner, profile, { chart: { synthetic: true }, display_name: "Synthetic", timezone: "Asia/Kolkata" });
    const pending = store.enqueue(owner, "chart", "Second question", "second");
    store.close();
    store = new WorkspaceStore(filename);
    store.recoverInterrupted();
    assert.equal(store.getJob(owner, running.id)?.status, "error");
    assert.equal(store.getJob(owner, pending.id)?.status, "pending");
    const calls: string[] = [];
    const worker = new JobWorker(store, async (input, resolvedOwner) => {
      assert.equal(resolvedOwner, owner);
      calls.push(input.message);
      input.evidence = { id: "reading-synthetic", schema_version: "iktara-evidence-v1", method: "compare", domain: "general", engine_revision: "fixture", chart_digest: "fixture", birth_time_quality: "unknown", items: [{ id: "E-0123456789abcdef", system: "western", kind: "pattern", detail: "Synthetic only" }], limitations: [] };
      return "Completed in the background [E-0123456789abcdef]";
    });
    worker.wake();
    for (
      let i = 0;
      i < 30 && store.getJob(owner, pending.id)?.status !== "completed";
      i++
    )
      await new Promise((resolve) => setTimeout(resolve, 5));
    await worker.stop();
    assert.deepEqual(
      calls,
      ["Second question"],
      "in-flight inference is never replayed after restart",
    );
    assert.equal(
      store.getJob(owner, pending.id)?.text,
      "Completed in the background [E-0123456789abcdef]",
    );
    assert.equal(
      store
        .workspace(owner)
        .messages.filter((message) => message.role === "assistant").length,
      1,
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
