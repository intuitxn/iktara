#!/usr/bin/env node
// Install a reviewed operator copy outside releases. This entry point never updates itself.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, symlink, readlink, stat, chmod, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

const root = path.resolve(process.env.IKTARA_DEPLOY_ROOT || path.join(homedir(), '.local/share/iktara-host'));
if (root === '/' || root === homedir()) throw new Error('Choose a dedicated IKTARA_DEPLOY_ROOT');
const repository = process.env.IKTARA_REPOSITORY || 'intuitxn/iktara';
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository');
const mode = process.argv[2] || 'status';
const shared = path.join(root, 'shared');
const releases = path.join(root, 'releases');
const repoCache = path.join(root, 'source.git');
const stateFile = path.join(root, 'state.json');
const shaPattern = /^[0-9a-f]{40}$/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = message => console.log(`${new Date().toISOString()} ${message}`);
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) if (/TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY/.test(key)) delete cleanEnv[key];
for (const key of ['NODE_OPTIONS', 'BUN_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT']) delete cleanEnv[key];
for (const key of Object.keys(cleanEnv)) if (key.startsWith('OPENCODE_')) delete cleanEnv[key];

async function exists(file) { try { await stat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function loadState() { try { return JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; } }
async function atomicJson(file, value) { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await rename(temp, file); }
function releasePath(sha) { if (!shaPattern.test(sha)) throw new Error('Invalid immutable revision'); return path.join(releases, sha); }
async function currentSha() {
  try {
    const target = await readlink(path.join(root, 'current'));
    const sha = path.basename(target);
    if (path.resolve(root, target) !== releasePath(sha)) throw new Error('Current symlink points outside release directory');
    return sha;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function select(sha) {
  const directory = releasePath(sha);
  if (!await exists(path.join(directory, '.validated.json'))) throw new Error('Release has not passed local validation');
  const temp = path.join(root, `current.${process.pid}.tmp`);
  await symlink(directory, temp);
  await rename(temp, path.join(root, 'current'));
}
function command(binary, args, cwd, { capture = false, env = cleanEnv } = {}) {
  return new Promise((resolve, reject) => {
    const task = spawn(binary, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let output = '';
    if (capture) { task.stdout.on('data', data => { output += data; }); task.stderr.resume(); }
    task.on('error', reject);
    task.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${path.basename(binary)} exited ${code}`)));
  });
}
async function setup() {
  for (const directory of [root, shared, releases, path.join(root, 'bin'), path.join(root, 'logs'), path.join(shared, 'runtime')]) { await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(directory, 0o700); }
  if (await exists(path.join(shared, '.env.local'))) await chmod(path.join(shared, '.env.local'), 0o600);
}
async function lock(name) {
  const file = path.join(root, `${name}.lock`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(file, 'wx', 0o600); await handle.writeFile(String(process.pid)); await handle.close();
      return () => unlink(file).catch(() => {});
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(await readFile(file, 'utf8'));
      if (!Number.isInteger(pid) || pid < 1) throw new Error(`Invalid ${name} lock; inspect it before retrying`);
      try { process.kill(pid, 0); throw new Error(`${name} is already running`); }
      catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
      await unlink(file);
    }
  }
  throw new Error('Could not acquire deployment lock');
}
async function github(route) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
  return response.json();
}
async function unpack(sha, directory) {
  await mkdir(directory, { mode: 0o700 });
  await new Promise((resolve, reject) => {
    const archive = spawn('git', ['--git-dir', repoCache, 'archive', sha], { env: cleanEnv, stdio: ['ignore', 'pipe', 'inherit'] });
    const tar = spawn('tar', ['-x', '-f', '-', '-C', directory], { env: cleanEnv, stdio: ['pipe', 'inherit', 'inherit'] });
    archive.stdout.pipe(tar.stdin);
    archive.on('error', reject); tar.on('error', reject);
    Promise.all([new Promise((done, fail) => archive.on('exit', code => code === 0 ? done() : fail(new Error('Git archive failed')))), new Promise((done, fail) => tar.on('exit', code => code === 0 ? done() : fail(new Error('Release extraction failed'))))]).then(resolve, reject);
  });
}
async function poll() {
  const unlock = await lock('deploy');
  try {
    if (await exists(path.join(root, 'paused'))) { log('Automatic deployment is paused'); return; }
    const sha = (await github('branches/main')).commit?.sha;
    releasePath(sha);
    if (sha === await currentSha()) return;
    const state = await loadState();
    if (sha === state.rejected) { log(`Skipping rejected revision ${sha.slice(0, 12)}`); return; }
    const runs = await github(`actions/workflows/local.yml/runs?branch=main&event=push&head_sha=${sha}&per_page=30`);
    const run = runs.workflow_runs?.filter(item => item.head_sha === sha && item.event === 'push' && item.head_branch === 'main' && item.repository?.full_name === repository).sort((a, b) => b.id - a.id)[0];
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') { log(`Waiting for successful push-to-main CI on ${sha.slice(0, 12)}`); return; }
    log(`Preparing ${sha.slice(0, 12)} after successful GitHub run ${run.id}`);
    if (!await exists(repoCache)) await command('git', ['init', '--bare', repoCache], root);
    await command('git', ['--git-dir', repoCache, 'fetch', '--no-tags', '--depth=1', `https://github.com/${repository}.git`, '+refs/heads/main:refs/heads/main'], root);
    const fetched = await command('git', ['--git-dir', repoCache, 'rev-parse', 'refs/heads/main'], root, { capture: true });
    if (fetched !== sha) { log('Main moved during preparation; checking the new revision next time'); return; }
    const directory = releasePath(sha);
    if (await exists(directory) && !await exists(path.join(directory, '.validated.json'))) {
      const attemptFile = path.join(root, `attempts-${sha}.json`);
      const attempts = await readFile(attemptFile, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return 1; throw error; });
      if (attempts >= 3) throw new Error(`Preparation failed three times for ${sha}; inspect the retained candidate before resetting its attempts file or publishing a fix`);
      const info = await stat(directory);
      if (info.uid !== process.getuid() || await currentSha() === sha) throw new Error('Refusing to move an active or differently owned candidate');
      await rename(directory, path.join(releases, `${sha}.failed-${Date.now()}`));
      await atomicJson(attemptFile, attempts + 1);
      log(`Retained failed candidate; retrying preparation (${attempts + 1}/3)`);
    }
    if (!await exists(directory)) {
      await unpack(sha, directory);
      const local = path.join(directory, 'apps/local');
      await command('uv', ['sync', '--frozen', '--python', '3.12'], path.join(directory, 'shastra-compute'));
      await command('npm', ['ci'], local);
      await command('npm', ['test'], local);
      await command('npm', ['run', 'build'], local);
      await command(process.execPath, ['scripts/deploy-smoke.mjs', directory], directory);
      await atomicJson(path.join(directory, '.validated.json'), { sha, githubRun: run.id, verifiedAt: new Date().toISOString() });
    }
    if ((await github('branches/main')).commit?.sha !== sha) { log('Main advanced; candidate retained but not activated'); return; }
    await select(sha);
    log(`Selected ${sha.slice(0, 12)}; supervisor will activate and verify it`);
  } finally { await unlock(); }
}
async function health(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    const value = await response.json();
    return response.ok && value.ok === true && value.chart?.ready === true && (!value.opencode?.configured || value.opencode.ready === true);
  } catch { return false; }
}
async function serve() {
  const unlock = await lock('supervisor');
  let child, stopping = false, running;
  const port = Number(process.env.PORT || 3210);
  async function stopChild() {
    if (!child) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]);
      if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }
    child = undefined;
    await delay(800);
  }
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
  async function rollback(sha) {
    const state = await loadState();
    const previous = state.active !== sha ? state.active : state.previous;
    await atomicJson(stateFile, { ...state, rejected: sha, failureAt: new Date().toISOString() });
    if (previous && previous !== sha) { await select(previous); log(`Rolled back ${sha.slice(0, 12)} to ${previous.slice(0, 12)}`); }
    else { await writeFile(path.join(root, 'paused'), 'First release failed; operator inspection required.\n', { mode: 0o600 }); throw new Error('No previous healthy release is available; deployments paused'); }
  }
  try {
    while (!stopping) {
      const selected = await currentSha();
      if (!selected) { await delay(3000); continue; }
      if (selected !== running || !child) {
        await stopChild();
        const state = await loadState();
        if (selected === state.rejected) { await rollback(selected); continue; }
        const directory = releasePath(selected);
        if (!await exists(path.join(directory, '.validated.json'))) throw new Error('Refusing unvalidated current release');
        log(`Starting ${selected.slice(0, 12)}`);
        child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: path.join(directory, 'apps/local'), detached: true, stdio: 'inherit', env: { ...cleanEnv, PORT: String(port), COMPUTE_PORT: process.env.COMPUTE_PORT || '8001', IKTARA_ENV_FILE: path.join(shared, '.env.local'), IKTARA_RUNTIME_DIR: path.join(shared, 'runtime') } });
        child.on('error', () => log('Release process could not start'));
        let ready = false;
        for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
          if (child.exitCode !== null || child.signalCode !== null || !child.pid) break;
          if (await health(port)) { ready = true; break; }
          await delay(1000);
        }
        if (stopping) break;
        if (!ready) { await stopChild(); await rollback(selected); running = undefined; continue; }
        const previous = state.active && state.active !== selected && state.active !== state.rejected
          ? state.active : state.previous !== selected ? state.previous : undefined;
        await atomicJson(stateFile, { ...state, active: selected, previous, activatedAt: new Date().toISOString() });
        running = selected;
        log(`Healthy release ${selected.slice(0, 12)} active on ${port}`);
      }
      await delay(5000);
      if (stopping || await currentSha() !== running) continue;
      if (child.exitCode !== null || child.signalCode !== null || !await health(port)) {
        let recovered = false;
        for (let attempt = 0; attempt < 2 && !stopping; attempt++) { await delay(3000); if (await health(port)) { recovered = true; break; } }
        if (!recovered && !stopping) { const failed = running; await stopChild(); await rollback(failed); running = undefined; }
      }
    }
  } finally { await stopChild(); await unlock(); }
}

try {
  await setup();
  if (mode === 'poll') await poll();
  else if (mode === 'serve') await serve();
  else if (mode === 'status') console.log(JSON.stringify({ root, repository, current: await currentSha(), paused: await exists(path.join(root, 'paused')), ...await loadState() }, null, 2));
  else if (mode === 'pause') { await writeFile(path.join(root, 'paused'), 'Operator paused automatic deployments.\n', { mode: 0o600 }); log('Automatic deployments paused; current app keeps running'); }
  else if (mode === 'resume') { if (await exists(path.join(root, 'paused'))) await unlink(path.join(root, 'paused')); log('Automatic deployments resumed'); }
  else if (mode === 'rollback') {
    const unlock = await lock('deploy');
    try {
      const state = await loadState();
      if (!state.previous) throw new Error('No previous healthy release recorded');
      await writeFile(path.join(root, 'paused'), 'Paused after manual rollback.\n', { mode: 0o600 });
      await select(state.previous);
      log(`Selected previous release ${state.previous}; automatic deployments paused until resume`);
    } finally { await unlock(); }
  } else throw new Error('Usage: deploy-host.mjs status|poll|serve|pause|resume|rollback');
} catch (error) { console.error(error.message); process.exitCode = 1; }
