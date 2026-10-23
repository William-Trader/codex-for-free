import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { exportLibrary, readLibrary, readConversation } from '../src/library.mjs';

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cfm-test-'));
  const codexHome = path.join(base, '.codex');
  fs.mkdirSync(codexHome, { recursive: true });
  const projectPath = path.join(base, 'work', 'demo');
  fs.mkdirSync(projectPath, { recursive: true });
  const rollout = path.join(codexHome, 'rollout.jsonl');
  const lines = [
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello' }] } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'hi, my key is ' + 'sk-' + 'x'.repeat(20) }] } }
  ];
  fs.writeFileSync(rollout, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const db = new DatabaseSync(path.join(codexHome, 'state_5.sqlite'));
  db.exec(`create table projects (id text, name text, path text);`);
  db.exec(`create table threads (id text, rollout_path text, title text, model text, model_provider text, reasoning_effort text, created_at integer, updated_at integer, cwd text, tokens_used integer, archived integer, project_id text);`);
  db.prepare('insert into projects values (?,?,?)').run('p1', 'Demo', projectPath);
  db.prepare('insert into threads values (?,?,?,?,?,?,?,?,?,?,?,?)').run(
    't1', rollout, 'Hello', 'deepseek-v4-pro', 'deepseek', 'high',
    Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), projectPath, 42, 0, 'p1'
  );
  db.close();
  return { base, codexHome, projectPath };
}

test('exportLibrary groups conversations by project and redacts secrets', () => {
  const f = fixture();
  const rootDir = path.join(f.base, 'library');
  const r = exportLibrary({ rootDir, codexHome: f.codexHome });
  assert.equal(r.projects, 1);
  assert.equal(r.conversations, 1);
  const idx = readLibrary({ rootDir });
  assert.equal(idx.projects[0].name, 'Demo');
  const mdRel = idx.conversations[0].files.markdown;
  assert.ok(mdRel.includes('/conversations/'));
  const c = readConversation({ rootDir, rel: mdRel });
  assert.doesNotMatch(c.text, /sk-[a-z0-9]{12,}/i);
  assert.match(c.text, /## 用户/);
  assert.match(c.text, /## 助手/);
  const jsonFile = path.join(rootDir, idx.conversations[0].files.json);
  const conv = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(conv.provider, 'deepseek');
  assert.equal(conv.messages.length, 2);
});
