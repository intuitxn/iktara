#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const runtime = await mkdtemp(path.join(tmpdir(), 'iktara-deploy-check-'));
const port = Number(process.env.IKTARA_CHECK_PORT || 3212);
const computePort = Number(process.env.IKTARA_CHECK_COMPUTE_PORT || 8002);
for (const value of [port, computePort]) if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error('Invalid smoke-test port');
const env = { ...process.env, PORT: String(port), COMPUTE_PORT: String(computePort), IKTARA_RUNTIME_DIR: runtime, IKTARA_ENV_FILE: path.join(runtime, 'no-model.env'), OPENCODE_MODEL: '', OPENCODE_API_KEY: '', OPENCODE_INTEGRATION: '' };
for (const key of Object.keys(env)) if (/TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY/.test(key)) delete env[key];
env.OPENCODE_API_KEY = '';
let child;
async function stop() {
  if (!child) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 4000))]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await stop(); process.exit(1); });
function command(binary, args, cwd) {
  return new Promise((resolve, reject) => {
    const task = spawn(binary, args, { cwd, env, stdio: 'inherit' });
    task.on('error', reject);
    task.on('exit', code => code === 0 ? resolve() : reject(new Error(`Smoke command exited ${code}`)));
  });
}
try {
  await command(path.join(repo, 'shastra-compute/.venv/bin/python'), ['-c', 'from datetime import date,time; from src.core.calculator import ChartCalculator; c=ChartCalculator().compute_chart(date_of_birth=date(1995,6,15), time_of_birth=time(12,0), latitude=28.6139, longitude=77.2090, timezone_str="Asia/Kolkata", birth_time_quality="exact"); assert len(c.tropical_planets)>=7; assert len(c.sidereal_planets)>=7; print("Synthetic chart computation passed")'], path.join(repo, 'shastra-compute'));
  child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: path.join(repo, 'apps/local'), env, detached: true, stdio: 'inherit' });
  let spawnFailure;
  child.on('error', error => { spawnFailure = error; });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnFailure) throw spawnFailure;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Candidate exited before readiness');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
      const data = await response.json();
      if (response.ok && data.ok && data.chart?.ready && data.opencode?.configured === false) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Candidate health checks failed');
  const page = await fetch(`http://127.0.0.1:${port}/`);
  if (!page.ok || !(await page.text()).includes('Iktara')) throw new Error('Candidate UI did not load');
  const workspace = await fetch(`http://127.0.0.1:${port}/api/workspace`);
  const cookie = workspace.headers.get('set-cookie')?.split(';')[0];
  if (!workspace.ok || !cookie?.startsWith('iktara_session=')) throw new Error('Anonymous workspace did not initialize');
  const chat = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ message: 'Deployment check', page: 'reflection' }) });
  if (chat.status !== 503) throw new Error('Unconfigured chat did not fail closed');
  console.log('Candidate startup, UI, chart service, and missing-key checks passed');
} finally {
  await stop();
  await rm(runtime, { recursive: true, force: true });
}
