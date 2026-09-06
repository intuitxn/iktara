import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function validateRelease(value) {
  if (value.product !== 'Iktara' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)) throw Error('Expected Iktara and a semantic release version');
  if (value.model !== 'opencode/deepseek-v4-flash' || value.runtime !== 'opencode-v2') throw Error('Model/runtime change requires an explicit release policy update');
  for (const field of ['changes', 'decisionLinks', 'limitations']) {
    if (!Array.isArray(value[field]) || value[field].some(item => typeof item !== 'string' || !item.trim())) throw Error(`Invalid ${field}`);
  }
  if (!value.changes.length) throw Error('Release needs user-visible changes');
  for (const link of value.decisionLinks) if (new URL(link).protocol !== 'https:') throw Error('Decision links must use HTTPS');
  return value;
}

export function record(root) {
  const release = validateRelease(JSON.parse(readFileSync(path.join(root, 'release.json'), 'utf8')));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=no')) throw Error('Commit tracked changes before generating an immutable release record');
  const files = ['apps/local/server/prompts.ts', 'apps/local/server/worlds.ts', 'apps/local/server/plugin.ts', 'apps/local/server/agent-tools.ts', 'apps/local/server/evidence.ts', 'shastra-compute/src/api/v1/evidence.py', 'docs/prompts/contributor.md', 'project.json'];
  return {
    ...release,
    tag: `iktara-v${release.version}`,
    revision: git('rev-parse', 'HEAD'),
    configuration: 'Declared model; deployment receipt must independently confirm the active model and health.',
    fingerprints: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])),
  };
}

export function notes(release) {
  return `# Iktara ${release.tag}\n\nRevision: ${release.revision}\nModel: ${release.model}\nRuntime: ${release.runtime}\n\n## Changes\n\n${release.changes.map(x => `- ${x}`).join('\n')}\n\n## Team decisions\n\n${release.decisionLinks.map(x => `- ${x}`).join('\n') || 'No decision links recorded. Human review is required before publication.'}\n\n## Deployment status\n\nThis is a release record, not proof of deployment. Attach a verified host/domain receipt before announcing it as live.\n\n## Limitations\n\n${release.limitations.map(x => `- ${x}`).join('\n')}\n\n## Prompt and agent fingerprints (SHA-256)\n\n${Object.entries(release.fingerprints).map(([file, hash]) => `- ${file}: ${hash}`).join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (process.argv[2] === 'check') {
    validateRelease(JSON.parse(readFileSync(path.join(root, 'release.json'), 'utf8')));
    console.log('Release manifest valid');
  } else {
    const value = record(root);
    console.log(process.argv[2] === 'json' ? JSON.stringify(value, null, 2) : notes(value));
  }
}
