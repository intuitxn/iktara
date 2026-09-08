import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** The documented HTTP contract for the prior-UI client, without real inference. */
test("HTTP contract: workspace shape, profile save, chart compute, and reset", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "iktara-contract-test-"));
  const compute = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/health") return Response.json({ ok: true });
      if (url.pathname === "/v1/chart/compute") {
        const profile = (await request.json()) as Record<string, unknown>;
        if (profile.birthplace === "Missing city") return Response.json({detail:{code:"PLACE_NOT_FOUND"}}, {status:400});
        assert.equal(profile.date_of_birth, "2000-01-01");
        return Response.json({
          chart: { synthetic: true, received: profile },
          display_name: "New Delhi",
          timezone: "Asia/Kolkata",
          latitude: 28.61,
          longitude: 77.21,
        });
      }
      return new Response("not found", { status: 404 });
    },
  });
  const reserve = createServer();
  await new Promise<void>((resolve) => reserve.listen(0, "127.0.0.1", resolve));
  const address = reserve.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve) => reserve.close(() => resolve()));
  const child = spawn(process.execPath, ["server/index.ts"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      PORT: String(port),
      IKTARA_RUNTIME_DIR: directory,
      OPENCODE_API_KEY: "",
      OPENCODE_MODEL: "",
      COMPUTE_URL: `http://127.0.0.1:${compute.port}`,
    },
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) {
          healthy = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(healthy, "HTTP server starts");
    const opened = await fetch(`${base}/api/workspace`);
    assert.equal(opened.status, 200);
    const cookie = opened.headers.get("set-cookie")!.split(";")[0]!;
    const workspace = (await opened.json()) as {
      profile: unknown;
      chart: unknown;
      messages: unknown[];
      worlds: { id: string }[];
    };
    assert.deepEqual(
      Object.keys(workspace).sort(),
      ["chart", "jobs", "messages", "profile", "worlds"].sort(),
    );
    assert.equal(workspace.profile, null);
    assert.equal(workspace.chart, null);
    assert.deepEqual(workspace.messages, []);
    assert.deepEqual(
      workspace.worlds.map((world) => world.id),
      ["reflection", "chart"],
    );

    const profile = {
      name: "Synthetic A",
      date_of_birth: "2000-01-01",
      time_of_birth: null,
      birthplace: "New Delhi",
      birth_time_quality: "unknown",
    };
    const json = (init: RequestInit, body?: unknown) =>
      fetch(`${base}${(init as { path?: string }).path || "/api/profile"}`, {
        ...init,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

    const saved = (await (
      await json({ method: "PUT", path: "/api/profile" } as RequestInit, {
        profile,
      })
    ).json()) as { profile: { name: string }; chart: unknown };
    assert.equal(saved.profile.name, "Synthetic A");
    assert.ok("chart" in saved, "PUT /api/profile returns the chart slot");
    assert.equal(saved.chart, null);

    const computed = (await (
      await json({ method: "POST", path: "/api/chart" } as RequestInit, {
        profile,
      })
    ).json()) as {
      profile: { name: string };
      chart: { synthetic: boolean };
      display_name: string;
      timezone: string;
    };
    assert.equal(computed.profile.name, "Synthetic A");
    assert.equal(computed.chart.synthetic, true);
    assert.equal(computed.display_name, "New Delhi");
    assert.equal(computed.timezone, "Asia/Kolkata");

    const failed = await json({method:"POST",path:"/api/chart"} as RequestInit,{profile:{...profile,birthplace:"Missing city"}});
    assert.equal(failed.status,400);
    assert.match(((await failed.json()) as {error:string}).error,/couldn’t find/);
    const preserved = await (await fetch(`${base}/api/workspace`,{headers:{Cookie:cookie}})).json() as {chart:{chart:{synthetic:boolean}}};
    assert.equal(preserved.chart.chart.synthetic,true,"failed calculation preserves the saved chart");

    // The earlier bare-profile body stays accepted.
    const bare = await json(
      { method: "POST", path: "/api/chart" } as RequestInit,
      profile,
    );
    assert.equal(bare.status, 200);

    const restored = (await (
      await fetch(`${base}/api/workspace`, { headers: { Cookie: cookie } })
    ).json()) as {
      profile: { name: string };
      chart: { chart: { synthetic: boolean }; display_name: string };
    };
    assert.equal(restored.profile.name, "Synthetic A");
    assert.equal(restored.chart.display_name, "New Delhi");
    assert.equal(restored.chart.chart.synthetic, true);

    const cleared = await fetch(`${base}/api/workspace`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(cleared.status, 200);
    assert.deepEqual(await cleared.json(), { ok: true });
    const afterReset = (await (
      await fetch(`${base}/api/workspace`, { headers: { Cookie: cookie } })
    ).json()) as { profile: unknown; chart: unknown; messages: unknown[] };
    assert.equal(afterReset.profile, null);
    assert.equal(afterReset.chart, null);
    assert.deepEqual(afterReset.messages, []);
  } finally {
    const stopped = new Promise<void>((resolve) =>
      child.once("exit", () => resolve()),
    );
    child.kill("SIGTERM");
    await Promise.race([
      stopped,
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await stopped;
    }
    compute.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
