import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease, notes } from './release-record.mjs';
const good = { product: 'Iktara', version: '0.1.0', model: 'opencode/deepseek-v4-flash', runtime: 'opencode-v2', changes: ['An improvement'], decisionLinks: [], limitations: [] };
test('release version and declared model are explicit', () => {
  assert.equal(validateRelease(good).version, '0.1.0');
  for (const version of ['v1', '../bad', '01.0.0']) assert.throws(() => validateRelease({ ...good, version }));
  assert.throws(() => validateRelease({ ...good, model: 'another-model' }));
  assert.throws(() => validateRelease({ ...good, decisionLinks: ['http://example.com'] }));
});
test('notes never equate publication with healthy deployment', () => {
  assert.match(notes({ ...good, tag: 'iktara-v0.1.0', revision: 'abc', fingerprints: {} }), /not proof of deployment/);
});
