import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKey, validateBaseUrl } from '../src/providers.mjs';

test('normalizeKey strips Bearer and rejects unsafe values', () => {
  assert.equal(normalizeKey('  Bearer sk-test-1234567890  '), 'sk-test-1234567890');
  assert.throws(() => normalizeKey(''), /API key/);
  assert.throws(() => normalizeKey('short'), /长度/);
  assert.throws(() => normalizeKey('sk-abc def-1234567890'), /空白/);
});

test('validateBaseUrl only allows https or localhost http', () => {
  assert.equal(validateBaseUrl('https://api.deepseek.com/v1/'), 'https://api.deepseek.com/v1');
  assert.equal(validateBaseUrl('http://127.0.0.1:8080/v1'), 'http://127.0.0.1:8080/v1');
  assert.equal(validateBaseUrl('http://localhost:8080'), 'http://localhost:8080');
  assert.throws(() => validateBaseUrl('http://example.com/v1'), /https/);
  assert.throws(() => validateBaseUrl('ftp://example.com'), /https/);
  assert.throws(() => validateBaseUrl('https://user:pass@example.com'), /用户名/);
});
