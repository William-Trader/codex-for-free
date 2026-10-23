import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/update.mjs';

test('compareVersions orders semver-ish tags', () => {
  assert.equal(compareVersions('1.0.3', '1.0.2'), 1);
  assert.equal(compareVersions('1.0.2', '1.0.3'), -1);
  assert.equal(compareVersions('1.0.3', '1.0.3'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
  assert.equal(compareVersions('v1.0.3', '1.0.3'), 0);
});
