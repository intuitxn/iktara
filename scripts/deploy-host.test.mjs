import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('supervisor activates healthy releases, restores prior release on startup failure, and supports paused rollback', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'iktara-supervisor-test-'));
  const reserve = createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const script = fileURLToPath(new URL('./deploy-host.mjs', import.meta.url));
  const env = { ...process.env, IKTARA_DEPLOY_ROOT: directory, PORT: String(port) };
  const shaA = 'a'.repeat(40), shaB = 'b'.repeat(40), shaC = 'c'.repeat(40);
  async function fixture(sha, broken = false) {
    const release = path.join(directory, 'releases', sha);
    await mkdir(path.join(release, 'apps/local/scripts'), { recursive: true });
    await writeFile(path.join(release, '.validated.json'), JSON.stringify({ sha }));
    await writeFile(path.join(release, 'apps/local/scripts/start.mjs'), broken ? 'process.exit(1);' : `import {createServer} from 'node:http'; const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,chart:{ready:true},opencode:{configured:false}}))});server.listen(Number(process.env.PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`);
  }
  async function select(sha) { const temp = path.join(directory, 'select.tmp'); await symlink(path.join(directory, 'releases', sha), temp); await rename(temp, path.join(directory, 'current')); }
  async function waitFor(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = await readFile(path.join(directory, 'state.json'), 'utf8').then(JSON.parse).catch(() => ({}));
      if (predicate(state)) return state;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Supervisor condition not reached. Output: ${output}`);
  }
  let child, output = '';
  try {
    await fixture(shaA); await fixture(shaB, true); await fixture(shaC); await select(shaA);
    child = spawn(process.execPath, [script, 'serve'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    await waitFor(state => state.active === shaA);
    await select(shaB);
    await waitFor(state => state.active === shaA && state.rejected === shaB);
    // Let rollback activation complete before selecting a new candidate.
    for (let attempt = 0; attempt < 50; attempt++) {
      if (output.includes(`Healthy release ${shaA.slice(0, 12)}`) && output.split('Healthy release').length >= 3) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    await select(shaC);
    const state = await waitFor(value => value.active === shaC);
    assert.equal(state.previous, shaA);
    await new Promise((resolve, reject) => {
      const task = spawn(process.execPath, [script, 'rollback'], { env, stdio: 'ignore' });
      task.on('error', reject); task.on('exit', code => code === 0 ? resolve() : reject(new Error('Manual rollback failed')));
    });
    await waitFor(value => value.active === shaA);
    assert.match(await readFile(path.join(directory, 'paused'), 'utf8'), /rollback/);
    assert.match(output, /Rolled back bbbbbbbbbbbb to aaaaaaaaaaaa/);
  } finally {
    if (child) {
      const stopped = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 8000))]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await stopped; }
    }
    await rm(directory, { recursive: true, force: true });
  }
});
