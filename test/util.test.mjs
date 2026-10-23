import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, fmtBytes, slugify } from '../src/util.mjs';

test('redact removes keys and bearer tokens', () => {
  const s = 'key ' + 'sk-' + 'x'.repeat(20) + ' and Bearer abcdefghijklmnopqrstuvwx and gho_' + 'y'.repeat(20);
  const r = redact(s);
  assert.doesNotMatch(r, /sk-[A-Za-z0-9]{12,}/);
  assert.doesNotMatch(r, /Bearer [A-Za-z0-9]{12,}/);
  assert.match(r, /sk-\*\*\*/);
});

test('fmtBytes and slugify', () => {
  assert.equal(fmtBytes(0), '0 B');
  assert.equal(fmtBytes(1024), '1.0 KB');
  assert.equal(slugify('Hello World / 项目'), 'hello-world-项目');
});
