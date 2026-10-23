import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertBlock, setRootKeys, withoutRootKeys } from '../src/toml-block.mjs';

test('upsertBlock replaces only the managed block', () => {
  const src = 'model = "a"\n\n[desktop]\nfollow = 1\n';
  const once = upsertBlock(src, 'provider:x', '[model_providers.x]\nname = "X"');
  assert.match(once, /\[model_providers\.x\]/);
  assert.match(once, /model = "a"/);
  const twice = upsertBlock(once, 'provider:x', '[model_providers.x]\nname = "Y"');
  assert.equal((twice.match(/\[model_providers\.x\]/g) || []).length, 1);
  assert.match(twice, /name = "Y"/);
  assert.doesNotMatch(twice, /name = "X"/);
});

test('setRootKeys only edits root keys, never table keys', () => {
  const src = [
    'model = "old"',
    'model_provider = "openai"',
    '',
    '[desktop]',
    'model = "keep-me"',
    '',
    '[model_providers.deepseek]',
    'wire_api = "responses"'
  ].join('\n');
  const out = setRootKeys(src, { model: 'new', model_provider: 'deepseek', model_catalog_json: '/tmp/c.json' });
  assert.match(out, /^# >>> cfm:defaults/m);
  assert.match(out, /model = "new"/);
  assert.match(out, /model_provider = "deepseek"/);
  assert.match(out, /\[desktop\]\nmodel = "keep-me"/);
  assert.equal((out.match(/^model = /gm) || []).length, 2);
});

test('withoutRootKeys leaves managed blocks untouched', () => {
  const src = '# >>> cfm:defaults\nmodel = "a"\n# <<< cfm:defaults\nmodel = "b"\n[table]\nmodel = "c"\n';
  const out = withoutRootKeys(src, ['model']);
  assert.match(out, /# >>> cfm:defaults\nmodel = "a"/);
  assert.doesNotMatch(out, /^model = "b"/m);
  assert.match(out, /model = "c"/);
});
