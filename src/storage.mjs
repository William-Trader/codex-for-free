import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CODEX_HOME, CFM_HOME } from './paths.mjs';
import { fmtBytes, dirSize, fileSize, ensureDir, stamp, redact } from './util.mjs';
import { libraryStats } from './library.mjs';

const dbFiles = (home) => {
  try { return fs.readdirSync(home).filter((f) => f.endsWith('.sqlite')).map((f) => path.join(home, f)); }
  catch { return []; }
};

function openDb(p, readOnly = true) {
  return new DatabaseSync(p, { readOnly });
}
function scalar(db, sql, fallback = null) {
  try { const r = db.prepare(sql).get(); return r ? Object.values(r)[0] : fallback; } catch { return fallback; }
}

export function storageReport({ codexHome = CODEX_HOME, cfmHome = CFM_HOME } = {}) {
  const sessions = dirSize(path.join(codexHome, 'sessions'));
  const dbs = {};
  for (const p of dbFiles(codexHome)) {
    const wal = fileSize(p + '-wal');
    const shm = fileSize(p + '-shm');
    dbs[path.basename(p)] = { bytes: fileSize(p) + wal + shm, main: fileSize(p), wal, shm };
  }
  let threads = 0, projects = 0, oldest = null, newest = null;
  try {
    const db = openDb(path.join(codexHome, 'state_5.sqlite'));
    threads = scalar(db, 'select count(*) from threads', 0) || 0;
    projects = scalar(db, 'select count(*) from projects', 0) || 0;
    oldest = scalar(db, 'select min(created_at) from threads', null);
    newest = scalar(db, 'select max(created_at) from threads', null);
    db.close();
  } catch {}
  const archivePath = path.join(cfmHome, 'archive');
  let archives = 0;
  try { archives = fs.existsSync(archivePath) ? fs.readdirSync(archivePath).length : 0; } catch {}
  const total = Object.values(dbs).reduce((a, b) => a + b.bytes, 0) + sessions.bytes;
  return {
    codexHome, cfmHome,
    totalBytes: total, total: fmtBytes(total),
    sessions: { ...sessions, path: path.join(codexHome, 'sessions'), size: fmtBytes(sessions.bytes) },
    databases: Object.fromEntries(Object.entries(dbs).map(([k, v]) => [k, { ...v, size: fmtBytes(v.bytes) }])),
    threads, projects,
    oldest: oldest ? new Date(oldest * 1000).toISOString() : null,
    newest: newest ? new Date(newest * 1000).toISOString() : null,
    archives,
    archivePath,
    library: libraryStats()
  };
}

export function vacuumAll({ apply = false, codexHome = CODEX_HOME } = {}) {
  const files = dbFiles(codexHome);
  const results = [];
  for (const p of files) {
    const before = fileSize(p) + fileSize(p + '-wal') + fileSize(p + '-shm');
    let error = null;
    if (apply) {
      let db;
      try {
        db = openDb(p, false);
        db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        db.exec('VACUUM');
      } catch (e) { error = String(e.message || e); }
      finally { try { db?.close(); } catch {} }
    }
    const after = fileSize(p) + fileSize(p + '-wal') + fileSize(p + '-shm');
    results.push({
      file: path.basename(p), before, after, saved: Math.max(0, before - after),
      beforeSize: fmtBytes(before), afterSize: fmtBytes(after),
      savedSize: fmtBytes(Math.max(0, before - after)),
      error: error ? redact(error) : null
    });
  }
  const saved = results.reduce((a, r) => a + r.saved, 0);
  return { applied: apply, totalSaved: saved, totalSavedSize: fmtBytes(saved), results };
}

function walkJsonl(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
  }
  return out;
}

export function archiveOldSessions({ days = 90, apply = false, codexHome = CODEX_HOME, cfmHome = CFM_HOME } = {}) {
  const cutoff = Date.now() - days * 86400000;
  const files = walkJsonl(path.join(codexHome, 'sessions'));
  const picked = files.filter((p) => {
    try { return fs.statSync(p).mtimeMs < cutoff; } catch { return false; }
  }).map((p) => ({ path: p, bytes: fileSize(p) }));
  const totalBytes = picked.reduce((a, b) => a + b.bytes, 0);
  const result = {
    days, applied: apply, count: picked.length, totalBytes, totalSize: fmtBytes(totalBytes),
    dest: null, manifest: null, moved: [], errors: [], warnings: []
  };
  if (!apply || !picked.length) return result;
  const batch = path.join(cfmHome, 'archive', stamp());
  result.dest = batch;
  for (const item of picked) {
    const rel = path.relative(path.join(codexHome, 'sessions'), item.path);
    const dest = path.join(batch, 'sessions', rel);
    try {
      ensureDir(path.dirname(dest), 0o700);
      fs.renameSync(item.path, dest);
      result.moved.push({ from: item.path, to: dest, bytes: item.bytes });
    } catch (e) {
      if (String(e.code) === 'EXDEV') {
        try {
          fs.copyFileSync(item.path, dest);
          result.warnings.push('copied (cross-device, original kept): ' + rel);
          result.moved.push({ from: item.path, to: dest, bytes: item.bytes, copied: true });
        } catch (e2) { result.errors.push({ file: rel, error: redact(e2.message) }); }
      } else {
        result.errors.push({ file: rel, error: redact(e.message) });
      }
    }
  }
  const manifest = path.join(batch, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({
    createdAt: new Date().toISOString(), days, codexHome, items: result.moved, errors: result.errors
  }, null, 2) + '\n', { mode: 0o600 });
  result.manifest = manifest;
  return result;
}

export function folderReport({ codexHome = CODEX_HOME } = {}) {
  const out = { projects: [], missing: [], duplicates: [] };
  let db;
  try { db = openDb(path.join(codexHome, 'state_5.sqlite')); } catch { return out; }
  try {
    const tables = new Set(db.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name));
    if (tables.has('projects')) {
      out.projects = db.prepare('select id, name, path from projects').all().map((p) => ({
        ...p, exists: (() => { try { return fs.existsSync(p.path); } catch { return false; } })()
      }));
    }
  } catch {}
  finally { try { db.close(); } catch {} }
  const seen = new Map();
  for (const p of out.projects) {
    if (!p.exists) out.missing.push(p);
    seen.set(p.path, (seen.get(p.path) || 0) + 1);
  }
  out.duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([path, n]) => ({ path, n }));
  return out;
}
