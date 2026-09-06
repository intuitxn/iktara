import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, 'project.json'), 'utf8'));
const files = [...new Set(['project.json', manifest.builder.definition, ...manifest.context])];
for (const file of [...files, manifest.engine.path, manifest.engine.entrypoint]) {
  const target = path.resolve(root, file);
  if (!target.startsWith(root) || !existsSync(target)) throw Error(`Invalid project source: ${file}`);
}
for (const system of manifest.engine.systems) {
  if (!existsSync(path.join(root, manifest.engine.path, `${system}.py`))) throw Error(`Missing engine: ${system}`);
}
if (process.argv[2] === 'check') {
  console.log('Project agent, context files, and engine sources verified');
} else {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  console.log(JSON.stringify({
    ...manifest,
    checkout: { revision: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')) },
    sourceFingerprints: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])),
    note: 'Source context only. Run host:status to verify deployment. No private runtime data is included.',
  }, null, 2));
}
