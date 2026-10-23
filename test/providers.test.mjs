import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, parseModels } from '../src/providers.mjs';

test('presets include deepseek and qwen with real endpoints', () => {
  assert.equal(PRESETS.deepseek.baseUrl, 'https://api.deepseek.com/v1');
  assert.ok(PRESETS.deepseek.models.some((m) => m.id === 'deepseek-v4-pro'));
  assert.match(PRESETS.qwen.baseUrl, /dashscope\.aliyuncs\.com/);
  assert.ok(PRESETS.qwen.models.length >= 2);
});

test('parseModels builds model entries and trims', () => {
  const m = parseModels('a, b ,c');
  assert.deepEqual(m.map((x) => x.id), ['a', 'b', 'c']);
  assert.ok(m.every((x) => x.context === 131072));
});
