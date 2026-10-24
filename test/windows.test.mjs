import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

import { lintToml, checkCodexConfig, REQUIRED_ROOT_KEYS } from '../src/toml-check.mjs';
import { tomlValue } from '../src/toml-block.mjs';
import { truncationLimit, reasoningLevels } from '../src/catalog.mjs';
import { which } from '../src/util.mjs';
import { CFM_HOME, IS_WINDOWS } from '../src/paths.mjs';
import { isSafeArchiveEntry } from '../src/maintenance.mjs';

test('lintToml rejects a duplicate root key', () => {
  const r = lintToml('model = "a"\nmodel = "b"\n');
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].type, 'duplicate-key');
  assert.equal(r.errors[0].line, 2);
});

test('lintToml rejects a duplicate provider table', () => {
  const text = '[model_providers.deepseek]\nname = "DeepSeek"\n\n[model_providers.deepseek]\nname = "Again"\n';
  const r = lintToml(text);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].type, 'duplicate-table');
  assert.match(r.errors[0].message, /declared twice/);
});

test('lintToml accepts the managed block layout that setRootKeys writes', () => {
  const text = [
    '# >>> cfm:defaults',
    'model = "deepseek-flash"',
    'model_provider = "deepseek"',
    '# <<< cfm:defaults',
    '',
    '[plugins."browser@openai-bundled"]',
    'enabled = true',
    ''
  ].join('\n');
  const r = lintToml(text);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.rootKeys.includes('model_provider'));
});

test('checkCodexConfig reports the four contract root keys', () => {
  const text = 'model = "deepseek-flash"\nmodel_provider = "deepseek"\n';
  const r = checkCodexConfig(text);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['model_catalog_json', 'model_reasoning_effort']);
  assert.deepEqual(REQUIRED_ROOT_KEYS.length, 4);
});

test('a context of 1,048,576 truncates tool output at 60,000 tokens', () => {
  assert.equal(truncationLimit(1048576), 60000);
  assert.equal(truncationLimit(131072), 20000);
  assert.equal(truncationLimit(32000), 10000);
});

test('reasoning levels keep only supported efforts', () => {
  const levels = reasoningLevels(['low', 'high', 'max']).map((l) => l.effort);
  assert.deepEqual(levels, ['low', 'high', 'max']);
  assert.ok(!levels.includes('medium'));
});

test('tomlValue escapes Windows paths as a valid TOML basic string', () => {
  // Use a literal Windows path: path.join would emit '/' when tests run on macOS/Linux.
  const p = 'C:\\Users\\Administrator\\.codex-for-mac\\catalog\\deepseek.json';
  const out = tomlValue(p);
  assert.equal(out[0], '"');
  assert.ok(out.includes('\\\\'), 'backslashes must be escaped');
  assert.equal(JSON.parse(out), p);
});

test('which resolves node through PATHEXT on Windows', () => {
  const found = which(IS_WINDOWS ? 'node.exe' : 'node');
  assert.ok(found, 'node must be resolvable from PATH');
  assert.ok(found.toLowerCase().endsWith(IS_WINDOWS ? 'node.exe' : 'node'));
});

test('archive entries cannot escape the restore directory', () => {
  assert.equal(isSafeArchiveEntry('.codex/config.toml'), true);
  assert.equal(isSafeArchiveEntry('Documents\\Codex Library\\index.json'), true);
  assert.equal(isSafeArchiveEntry('../etc/passwd'), false);
  assert.equal(isSafeArchiveEntry('..\\..\\Windows\\System32\\x.dll'), false);
  assert.equal(isSafeArchiveEntry('/etc/passwd'), false);
  assert.equal(isSafeArchiveEntry('C:/Windows/System32/x.dll'), false);
  assert.equal(isSafeArchiveEntry(''), false);
});

test('CFM_HOME keeps the macOS directory name for cross-port parity', () => {
  assert.equal(path.basename(CFM_HOME), '.codex-for-mac');
  assert.equal(path.isAbsolute(CFM_HOME), true);
});
