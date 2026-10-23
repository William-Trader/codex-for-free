import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { storageReport, vacuumAll, archiveOldSessions, folderReport } from './storage.mjs';
import { readLibrary, readConversation, exportLibrary, libraryRoot, libraryStats, revealPath } from './library.mjs';
import { listSkills } from './skills.mjs';
import { listProviders, useProvider, testProvider, loadRegistry } from './providers.mjs';
import { locateCodex, CFM_HOME, HOME } from './paths.mjs';
import { run, redact, platform } from './util.mjs';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

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
    folders: folderReport()
  };
}

function reveal(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel });
  spawn('open', ['-R', p], { detached: true, stdio: 'ignore' }).unref();
  return p;
}
function openDir(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel: rel || '.' });
  spawn('open', [p], { detached: true, stdio: 'ignore' }).unref();
  return p;
}
function openFile(rel) {
  const rootDir = libraryRoot();
  const p = revealPath({ rootDir, rel });
  spawn('open', [p], { detached: true, stdio: 'ignore' }).unref();
  return p;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
        const f = path.join(PUBLIC, 'index.html');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(f));
        return;
      }
      if (req.method === 'GET' && u.pathname === '/api/summary') return json(res, 200, summary());
      if (req.method === 'GET' && u.pathname === '/api/library') return json(res, 200, readLibrary());
      if (req.method === 'GET' && u.pathname === '/api/conversation') {
        const rel = u.searchParams.get('rel');
        if (!rel) return json(res, 400, { error: 'rel required' });
        return json(res, 200, readConversation({ rel }));
      }
      if (req.method === 'GET' && u.pathname === '/api/providers') return json(res, 200, { providers: listProviders(), registry: Object.keys(loadRegistry().providers) });
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
      json(res, 404, { error: 'not found' });
    } catch (e) {
      json(res, 500, { error: redact(e.message || String(e)) });
    }
  });
}

export function startServer({ port = 4317, open = true } = {}) {
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    if (open) spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    console.log(`codex-for-mac UI: ${url}`);
    console.log(`本地库: ${libraryRoot()}`);
  });
  return server;
}
