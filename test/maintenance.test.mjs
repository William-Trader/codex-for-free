import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { searchLibrary } from '../src/maintenance.mjs';

test('searchLibrary finds markdown and skips archive by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cff-search-'));
  try {
    fs.mkdirSync(path.join(root, 'projects', 'demo', 'conversations'), { recursive: true });
    fs.writeFileSync(path.join(root, 'projects', 'demo', 'conversations', 'one.md'), '# Alpha\nfind me\n');
    fs.mkdirSync(path.join(root, '_archive'), { recursive: true });
    fs.writeFileSync(path.join(root, '_archive', 'old.md'), 'find me too\n');
    const r = searchLibrary('find me', { rootDir: root, limit: 10 });
    assert.equal(r.total, 1);
    assert.equal(r.matches[0].path, 'projects/demo/conversations/one.md');
    assert.equal(r.matches[0].line, 2);
    const all = searchLibrary('find me', { rootDir: root, limit: 10, includeArchive: true });
    assert.equal(all.total, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('searchLibrary returns no matches for missing query text', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cff-search-'));
  try {
    fs.writeFileSync(path.join(root, 'a.md'), 'hello\n');
    const r = searchLibrary('not present', { rootDir: root });
    assert.equal(r.total, 0);
    assert.deepEqual(r.matches, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
