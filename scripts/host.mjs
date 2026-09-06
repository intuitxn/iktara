import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (!['status', 'poll'].includes(mode)) throw Error('Usage: node scripts/host.mjs status|poll');
const root = process.env.IKTARA_DEPLOY_ROOT || path.join(homedir(), '.local/share/iktara-host');
if (!path.isAbsolute(root)) throw Error('IKTARA_DEPLOY_ROOT must be absolute');
const operator = path.join(root, 'bin/deploy-host.mjs');
if (!existsSync(operator)) throw Error('No installed Iktara host here. See ops/DEPLOYMENT.md for host setup.');
if (mode === 'poll') console.log('Checking CI-approved main through the installed host updater. Local working files are not deployed.');
const result = spawnSync(process.execPath, [operator, mode], { stdio: 'inherit', env: { ...process.env, IKTARA_DEPLOY_ROOT: root } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
