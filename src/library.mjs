import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { CODEX_HOME, DEFAULT_LIBRARY, cfmConfig, saveCfmConfig, HOME } from './paths.mjs';
import { ensureDir, slugify, redact, fmtBytes, dirSize } from './util.mjs';

export const SCHEMA = 'codex-for-mac/library@1';

export function libraryRoot() {
  return process.env.CFM_LIBRARY || cfmConfig().libraryRoot || DEFAULT_LIBRARY;
}
export function setLibraryRoot(dir) {
  saveCfmConfig({ libraryRoot: path.resolve(dir) });
  return libraryRoot();
}

function hash6(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 6);
}
function projectSlug(name, p) {
  return `${slugify(name || path.basename(p || 'inbox'), 40)}-${hash6(p || name || 'inbox')}`;
}
function safeRel(rootDir, p) { return path.relative(rootDir, p).split(path.sep).join('/'); }
function inside(rootDir, p) {
  const rel = path.relative(rootDir, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function textFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c.text === 'string') return c.text;
      if (c && typeof c.output_text === 'string') return c.output_text;
      if (c && c.type === 'input_text' && c.text) return c.text;
      return '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

export function readRollout(file) {
  const msgs = [];
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return msgs; }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const p = o.payload || {};
    if (o.type === 'response_item' && p.type === 'message' && (p.role === 'user' || p.role === 'assistant')) {
      const text = textFromContent(p.content);
      if (text.trim()) msgs.push({ role: p.role, text: redact(text), at: o.timestamp || null });
    }
  }
  return msgs;
}

function openState(codexHome) {
  const p = path.join(codexHome, 'state_5.sqlite');
  return new DatabaseSync(p, { readOnly: true });
}

function loadProjects(db) {
  try { return db.prepare('select id, name, path from projects').all(); } catch { return []; }
}

function bestProject(projects, cwd, projectId) {
  if (projectId) {
    const exact = projects.find((p) => p.id === projectId);
    if (exact) return exact;
  }
  if (!cwd) return null;
  const norm = (s) => String(s || '').replace(/\/+$/, '');
  let best = null;
  for (const p of projects) {
    if (!p.path) continue;
    const pp = norm(p.path);
    if (norm(cwd) === pp || norm(cwd).startsWith(pp + '/')) {
      if (!best || pp.length > norm(best.path).length) best = p;
    }
  }
  return best;
}

export function exportLibrary({ rootDir = libraryRoot(), codexHome = CODEX_HOME, force = false, limit = 0 } = {}) {
  ensureDir(rootDir, 0o700);
  const projectsDir = path.join(rootDir, 'projects');
  const inboxDir = path.join(rootDir, 'inbox');
  ensureDir(projectsDir, 0o700);
  ensureDir(inboxDir, 0o700);

  const db = openState(codexHome);
  let threads = [];
  let projects = [];
  try {
    projects = loadProjects(db);
    threads = db.prepare('select * from threads order by created_at asc').all();
  } finally { db.close(); }
  if (limit > 0) threads = threads.slice(-limit);

  const projIndex = new Map();
  const convIndex = [];
  const skipped = [];
  const missing = [];
  let bytes = 0;

  function ensureProject(proj) {
    const name = proj?.name || (proj?.path ? path.basename(proj.path) : 'Inbox');
    const p = proj?.path || '';
    const slug = p ? projectSlug(name, p) : 'inbox';
    if (projIndex.has(slug)) return projIndex.get(slug);
    const dir = p ? path.join(projectsDir, slug) : inboxDir;
    ensureDir(dir, 0o700);
    const meta = {
      schema: 'codex-for-mac/project@1',
      id: proj?.id || null,
      name,
      path: p || null,
      slug,
      dir: safeRel(rootDir, dir),
      missing: p ? !fs.existsSync(p) : false,
      createdAt: new Date().toISOString(),
      conversations: 0
    };
    projIndex.set(slug, meta);
    return meta;
  }

  for (const t of threads) {
    let proj = bestProject(projects, t.cwd, t.project_id);
    if (!proj && t.cwd) proj = { id: null, name: path.basename(t.cwd), path: t.cwd };
    const pmeta = ensureProject(proj);
    const created = t.created_at ? new Date(Number(t.created_at) * 1000) : new Date();
    const ymd = created.toISOString().slice(0, 10).replace(/-/g, '');
    const convDir = path.join(rootDir, pmeta.dir, pmeta.slug === 'inbox' ? '' : 'conversations');
    ensureDir(convDir, 0o700);
    const base = `${ymd}-${slugify(t.title || t.id, 36)}-${String(t.id).slice(0, 8)}`;
    const mdFile = path.join(convDir, base + '.md');
    const jsonFile = path.join(convDir, base + '.json');
    if (!t.rollout_path || !fs.existsSync(t.rollout_path)) {
      missing.push({ id: t.id, title: t.title });
      continue;
    }
    if (fs.existsSync(jsonFile) && !force) {
      skipped.push(jsonFile);
    } else {
      const messages = readRollout(t.rollout_path);
      const conv = {
        schema: 'codex-for-mac/conversation@1',
        id: t.id,
        title: redact(t.title || t.id),
        createdAt: created.toISOString(),
        updatedAt: t.updated_at ? new Date(Number(t.updated_at) * 1000).toISOString() : null,
        model: t.model || null,
        provider: t.model_provider || null,
        reasoningEffort: t.reasoning_effort || null,
        cwd: t.cwd || null,
        project: { slug: pmeta.slug, name: pmeta.name, path: pmeta.path },
        tokensUsed: t.tokens_used || 0,
        archived: !!t.archived,
        source: { rollout: t.rollout_path },
        messages
      };
      fs.writeFileSync(jsonFile, JSON.stringify(conv, null, 2) + '\n', { mode: 0o600 });
      const md = [
        '---',
        `id: ${t.id}`,
        `title: ${JSON.stringify(conv.title)}`,
        `created: ${conv.createdAt}`,
        `project: ${JSON.stringify(pmeta.name)}`,
        `model: ${conv.model || 'unknown'}`,
        `provider: ${conv.provider || 'unknown'}`,
        '---', '',
        `# ${conv.title}`, '',
        `- 项目：${pmeta.name}${pmeta.path ? '（' + pmeta.path + '）' : ''}`,
        `- 模型：\`${conv.model || 'unknown'}\` / \`${conv.provider || 'unknown'}\``,
        `- 时间：${conv.createdAt}`,
        `- 消息数：${messages.length}`, '', '---', ''
      ];
      for (const m of messages) {
        md.push(m.role === 'user' ? '## 用户' : '## 助手', '', m.text, '');
      }
      const body = md.join('\n');
      fs.writeFileSync(mdFile, body, { mode: 0o600 });
      bytes += Buffer.byteLength(body) + Buffer.byteLength(JSON.stringify(conv));
      pmeta.conversations += 1;
    }
    convIndex.push({
      id: t.id,
      title: redact(t.title || t.id),
      projectSlug: pmeta.slug,
      projectName: pmeta.name,
      cwd: t.cwd || null,
      createdAt: created.toISOString(),
      model: t.model || null,
      provider: t.model_provider || null,
      files: { markdown: safeRel(rootDir, mdFile), json: safeRel(rootDir, jsonFile) }
    });
  }

  for (const meta of projIndex.values()) {
    if (meta.slug === 'inbox') continue;
    const dir = path.join(rootDir, meta.dir);
    ensureDir(dir, 0o700);
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(meta, null, 2) + '\n', { mode: 0o600 });
  }

  let prev = { projects: [], conversations: [] };
  try { prev = JSON.parse(fs.readFileSync(path.join(rootDir, 'index.json'), 'utf8')); } catch {}
  const projectMap = new Map((prev.projects || []).map((p) => [p.slug, p]));
  for (const p of projIndex.values()) projectMap.set(p.slug, p);
  const convMap = new Map((prev.conversations || []).map((c) => [c.id, c]));
  for (const c of convIndex) convMap.set(c.id, c);
  const mergedProjects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const mergedConversations = [...convMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const p of mergedProjects) {
    p.conversations = mergedConversations.filter((c) => c.projectSlug === p.slug).length;
  }
  const index = {
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    root: rootDir,
    projects: mergedProjects,
    conversations: mergedConversations
  };
  fs.writeFileSync(path.join(rootDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', { mode: 0o600 });
  const readme = path.join(rootDir, '_README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, [
      '# Codex 本地对话库', '',
      '这个目录由 codex-for-mac 生成，所有文件都是普通 Markdown / JSON，可直接用 Finder、Obsidian、VS Code 浏览。', '',
      '- 每个项目一个文件夹：`projects/<项目名>-<hash>/`',
      '- 项目元数据：`project.json`',
      '- 每个对话两份：同名 `.md`（阅读）与 `.json`（结构化）',
      '- 未归属项目的对话放在 `inbox/`',
      '- 总索引：`index.json`', '',
      '删除本目录不会影响 Codex 本体；重新执行 `cfm library export` 可再生成。', ''
    ].join('\n'), { mode: 0o600 });
  }
  const size = dirSize(rootDir);
  return {
    root: rootDir,
    projects: index.projects.filter((p) => p.slug !== 'inbox').length,
    conversations: convIndex.length,
    skipped: skipped.length, missing: missing.length, bytes,
    size: fmtBytes(size.bytes), index: path.join(rootDir, 'index.json')
  };
}

export function readLibrary({ rootDir = libraryRoot() } = {}) {
  const p = path.join(rootDir, 'index.json');
  try {
    const idx = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...idx, root: rootDir, exists: true };
  } catch {
    return { schema: SCHEMA, root: rootDir, projects: [], conversations: [], exists: false };
  }
}

export function conversationPath(rootDir, rel) {
  const p = path.resolve(rootDir, rel);
  if (!inside(rootDir, p)) throw new Error('path outside library');
  return p;
}

export function readConversation({ rootDir = libraryRoot(), rel }) {
  const p = conversationPath(rootDir, rel);
  if (!fs.existsSync(p)) throw new Error('not found');
  return { path: p, text: fs.readFileSync(p, 'utf8').slice(0, 200000), bytes: fs.statSync(p).size };
}

export function revealPath({ rootDir = libraryRoot(), rel }) {
  const p = path.resolve(rootDir, rel || '.');
  if (!inside(rootDir, p) && p !== path.resolve(rootDir)) throw new Error('path outside library');
  return p;
}

export function libraryStats({ rootDir = libraryRoot() } = {}) {
  const idx = readLibrary({ rootDir });
  const size = dirSize(rootDir);
  return {
    root: rootDir, exists: idx.exists,
    projects: idx.projects?.length || 0,
    conversations: idx.conversations?.length || 0,
    bytes: size.bytes, size: fmtBytes(size.bytes),
    generatedAt: idx.generatedAt || null
  };
}
