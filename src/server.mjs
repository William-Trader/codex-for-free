import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { storageReport, vacuumAll, archiveOldSessions, folderReport } from './storage.mjs';
import { readLibrary, readConversation, exportLibrary, libraryRoot, libraryStats, revealPath } from './library.mjs';
import { listSkills } from './skills.mjs';
import { PRESETS, parseModels, listProviders, useProvider, testProvider, loadRegistry, testConnection, onboardProvider } from './providers.mjs';
import { checkForUpdates, updateNow } from './update.mjs';
import { locateCodex, CODEX_HOME, CFM_HOME, HOME, CONFIG_PATH } from './paths.mjs';
import { PROFILE } from './profile.mjs';
import { run, redact, platform, openPath as openTarget } from './util.mjs';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

const MIME = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon', '.webp': 'image/webp'
};
function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return false; }
  if (!rel || rel.includes('\0')) return false;
  const p = path.resolve(PUBLIC, rel);
  if (!p.startsWith(PUBLIC + path.sep)) return false;
  let st;
  try { st = fs.statSync(p); } catch { return false; }
  if (!st.isFile()) return false;
  const type = MIME[path.extname(p).toLowerCase()];
  if (!type) return false;
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  res.end(fs.readFileSync(p));
  return true;
}

function modelProvider() {
  try {
    const s = fs.readFileSync(CONFIG_PATH, 'utf8');
    const m = s.match(/^model_provider\s*=\s*"([^"]+)"/m);
    return m ? m[1] : null;
  } catch { return null; }
}
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
const hits = new Map();
function rateLimited(req) {
  const ip = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 30) return true;
  arr.push(now); hits.set(ip, arr); return false;
}

function json(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

async function body(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1024 * 1024) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function codexInfo() {
  const bin = locateCodex();
  if (!bin) return { found: false, bin: null, version: null };
  const r = run(bin, ['--version'], { timeout: 8000 });
  return { found: true, bin, version: (r.stdout || '').trim() || null };
}

function summary() {
  return {
    app: { name: 'codex-for-mac', version: pkg.version, platform: platform() },
    storage: storageReport(),
    library: libraryStats(),
    codex: codexInfo(),
    skills: (() => { const s = listSkills(); return { count: s.skills.length, plugins: s.plugins.length, marketplaces: s.marketplaces.length }; })(),
    providers: listProviders(),
    onboarding: { configured: Boolean(modelProvider() || listProviders().length), provider: modelProvider() },
    folders: folderReport()
  };
}

function reveal(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel });
  openTarget(p, { reveal: true });
  return p;
}
function openDir(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel: rel || '.' });
  openTarget(p);
  return p;
}
function openFile(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel });
  openTarget(p);
  return p;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
        const f = path.join(PUBLIC, 'index.html');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(f));
        return;
      }
      if (req.method === 'GET' && u.pathname === '/about') {
        const f = path.join(PUBLIC, 'about.html');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(f));
        return;
      }
      if (req.method === 'GET' && u.pathname === '/api/summary') return json(res, 200, summary());
      if (req.method === 'GET' && u.pathname === '/api/update') return json(res, 200, await checkForUpdates());
      if (req.method === 'GET' && u.pathname === '/api/onboarding') {
        return json(res, 200, {
          configured: Boolean(modelProvider() || listProviders().length),
          provider: modelProvider(),
          presets: Object.entries(PRESETS).map(([id, p]) => ({
            id, name: p.name, baseUrl: p.baseUrl, models: p.models, docs: p.docs, recommended: id === 'deepseek'
          }))
        });
      }
      if (req.method === 'GET' && u.pathname === '/api/about') return json(res, 200, { ...PROFILE, app: { name: 'Codex for Free', version: pkg.version, repo: PROFILE.repo } });
      if (req.method === 'GET' && u.pathname === '/api/library') return json(res, 200, readLibrary());
      if (req.method === 'GET' && u.pathname === '/api/conversation') {
        const rel = u.searchParams.get('rel');
        if (!rel) return json(res, 400, { error: 'rel required' });
        return json(res, 200, readConversation({ rel }));
      }
      if (req.method === 'GET' && u.pathname === '/api/providers') return json(res, 200, { providers: listProviders(), registry: Object.keys(loadRegistry().providers) });
      if (req.method === 'POST' && !originOk(req)) return json(res, 403, { error: 'origin not allowed' });
      if (req.method === 'POST' && rateLimited(req)) return json(res, 429, { error: 'too many requests' });
      if (req.method === 'POST' && u.pathname === '/api/update/run') return json(res, 200, updateNow());
      if (req.method === 'POST' && u.pathname === '/api/chat') {
        const b = await body(req);
        const prompt = String(b.prompt || '').trim();
        if (!prompt) return json(res, 400, { error: 'prompt required' });
        const bin = locateCodex();
        if (!bin) return json(res, 400, { error: 'Codex CLI not found' });
        const session = String(b.sessionId || '').trim();
        const args = session
          ? ['exec', 'resume', session, '--json', '--skip-git-repo-check', '--sandbox', 'read-only', prompt]
          : ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', prompt];
        const child = spawn(bin, args, {
          env: { ...process.env, CODEX_HOME },
          cwd: process.env.CFM_CHAT_CWD || HOME
        });
        // codex exec reads stdin when it is a pipe; close it so it does not wait forever.
        try { child.stdin.end(); } catch {}
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
          'x-accel-buffering': 'no'
        });
        res.flushHeaders?.();
        let buf = '';
        const sendLine = (line) => {
          if (!line.trim() || res.writableEnded) return;
          try { res.write('data: ' + line + '\n\n'); } catch {}
        };
        child.stdout.on('data', (d) => {
          buf += d.toString();
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            sendLine(line);
          }
        });
        child.stderr.on('data', (d) => {
          const text = redact(d.toString()).trim();
          if (!text) return;
          // codex exec prints this on every run; it is not an error.
          if (/Reading additional input from stdin/i.test(text)) return;
          if (!/(error|failed|exception|denied|refused|not found)/i.test(text)) return;
          sendLine(JSON.stringify({ type: 'stderr', text: text.slice(0, 2000) }));
        });
        child.on('close', () => {
          if (buf) sendLine(buf);
          if (!res.writableEnded) res.end();
        });
        child.on('error', () => { if (!res.writableEnded) res.end(); });
        req.on('close', () => { try { child.kill(); } catch {} });
        return;
      }
      if (req.method === 'POST' && u.pathname === '/api/onboarding/test') {
        const b = await body(req);
        const preset = PRESETS[b.presetId];
        if (!preset) return json(res, 400, { error: 'unknown preset' });
        const models = Array.isArray(b.models) ? b.models : (typeof b.models === 'string' ? parseModels(b.models) : preset.models);
        const model = b.model || models[0]?.id;
        try {
          const r = await testConnection({ baseUrl: b.baseUrl || preset.baseUrl, key: b.key, model });
          return json(res, 200, r);
        } catch (e) { return json(res, 400, { error: redact(e.message) }); }
      }
      if (req.method === 'POST' && u.pathname === '/api/onboarding/apply') {
        const b = await body(req);
        const models = Array.isArray(b.models) ? b.models : (typeof b.models === 'string' ? parseModels(b.models) : undefined);
        try {
          const r = await onboardProvider({ presetId: b.presetId, id: b.id, key: b.key, baseUrl: b.baseUrl, models, model: b.model, effort: b.effort });
          return json(res, 200, r);
        } catch (e) { return json(res, 400, { error: redact(e.message) }); }
      }
      if (req.method === 'GET' && u.pathname === '/api/skills') return json(res, 200, listSkills());
      if (req.method === 'POST' && u.pathname === '/api/library/export') {
        const b = await body(req);
        return json(res, 200, exportLibrary({ force: !!b.force, limit: Number(b.limit || 0) }));
      }
      if (req.method === 'POST' && u.pathname === '/api/reveal') {
        const b = await body(req);
        if (b.openDir) return json(res, 200, { opened: openDir(b.rel) });
        if (b.openFile) return json(res, 200, { opened: openFile(b.rel) });
        return json(res, 200, { revealed: reveal(b.rel || '.') });
      }
      if (req.method === 'POST' && u.pathname === '/api/storage/vacuum') {
        const b = await body(req);
        return json(res, 200, vacuumAll({ apply: !!b.apply }));
      }
      if (req.method === 'POST' && u.pathname === '/api/storage/archive') {
        const b = await body(req);
        return json(res, 200, archiveOldSessions({ days: Number(b.days || 90), apply: !!b.apply }));
      }
      if (req.method === 'POST' && u.pathname === '/api/providers/use') {
        const b = await body(req);
        if (!b.id) return json(res, 400, { error: 'id required' });
        const r = useProvider(b.id, { model: b.model, effort: b.effort });
        return json(res, 200, { ok: true, model: r.model, effort: r.effort, catalog: r.catalog.path });
      }
      if (req.method === 'POST' && u.pathname === '/api/providers/test') {
        const b = await body(req);
        if (!b.id) return json(res, 400, { error: 'id required' });
        return json(res, 200, await testProvider(b.id));
      }
      if (req.method === 'GET' && serveStatic(res, u.pathname)) return;
      json(res, 404, { error: 'not found' });
    } catch (e) {
      json(res, 500, { error: redact(e.message || String(e)) });
    }
  });
}

export function startServer({ port = 4317, open = true, openPath = '/' } = {}) {
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    // Windows has no `open`; explorer.exe is synchronous and cannot emit an
    // unhandled ENOENT that would take the server down with it.
    if (open) { try { openTarget(url + openPath); } catch {} }
    console.log(`codex-for-mac UI: ${url}`);
    console.log(`本地库: ${libraryRoot()}`);
  });
  return server;
}
