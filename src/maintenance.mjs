import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HOME, CFM_HOME, CONFIG_PATH } from './paths.mjs';
import { libraryRoot } from './library.mjs';
import { fmtBytes } from './util.mjs';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '_archive') continue;
      walk(p, out);
    } else if (ent.isFile()) out.push(p);
  }
  return out;
}

export function searchLibrary(query, { rootDir = libraryRoot(), limit = 100, includeJson = false, includeArchive = false } = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('search query required');
  const files = [];
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!includeArchive && ent.name === '_archive') continue;
        scan(p);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (ext === '.md' || ext === '.txt' || (includeJson && ext === '.json')) files.push(p);
      }
    }
  };
  scan(rootDir);
  const needle = q.toLowerCase();
  const matches = [];
  let total = 0;
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;
      total += 1;
      if (matches.length < limit) {
        matches.push({
          path: path.relative(rootDir, file),
          line: i + 1,
          text: lines[i].trim().slice(0, 300)
        });
      }
    }
  }
  return { root: rootDir, query: q, total, truncated: total > matches.length, matches };
}

function backupEntries() {
  const entries = [];
  if (fs.existsSync(path.join(HOME, '.codex', 'config.toml'))) entries.push('.codex/config.toml');
  if (fs.existsSync(CFM_HOME)) entries.push(path.relative(HOME, CFM_HOME));
  const lib = libraryRoot();
  if (fs.existsSync(lib)) entries.push(path.relative(HOME, lib));
  return entries;
}

export function createBackup({ out } = {}) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
  const dir = out ? path.dirname(path.resolve(out)) : path.join(HOME, 'Documents', 'CodexForFree-Backups');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const archive = out ? path.resolve(out) : path.join(dir, `codex-for-free-backup-${stamp}.tar.gz`);
  const entries = backupEntries();
  if (!entries.length) throw new Error('nothing to back up');
  const r = spawnSync('tar', ['-czf', archive, '-C', HOME, ...entries], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || 'tar failed').trim());
  fs.chmodSync(archive, 0o600);
  return {
    ok: true,
    path: archive,
    size: fmtBytes(fs.statSync(archive).size),
    entries
  };
}

export function restoreBackup(archive, { yes = false } = {}) {
  if (!yes) throw new Error('restore requires --yes');
  const src = path.resolve(archive);
  if (!fs.existsSync(src)) throw new Error('archive not found: ' + src);
  const list = spawnSync('tar', ['-tzf', src], { encoding: 'utf8' });
  if (list.status !== 0) throw new Error((list.stderr || 'cannot read archive').trim());
  const entries = (list.stdout || '').split('\n').filter(Boolean);
  for (const e of entries) {
    if (e.startsWith('/') || e.split('/').includes('..')) throw new Error('unsafe archive entry: ' + e);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cff-restore-'));
  try {
    const x = spawnSync('tar', ['-xzf', src, '-C', tmp], { encoding: 'utf8' });
    if (x.status !== 0) throw new Error((x.stderr || 'extract failed').trim());
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
    const backupDir = path.join(HOME, 'Documents', 'CodexForFree-Backups', 'restore-' + stamp);
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

    const restored = [];
    const tmpCfg = path.join(tmp, '.codex', 'config.toml');
    if (fs.existsSync(tmpCfg)) {
      if (fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, path.join(backupDir, 'config.toml'));
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.copyFileSync(tmpCfg, CONFIG_PATH);
      fs.chmodSync(CONFIG_PATH, 0o600);
      restored.push('config');
    }

    const tmpCfm = path.join(tmp, '.codex-for-mac');
    if (fs.existsSync(tmpCfm)) {
      if (fs.existsSync(CFM_HOME)) fs.cpSync(CFM_HOME, path.join(backupDir, 'codex-for-mac'), { recursive: true });
      fs.cpSync(tmpCfm, CFM_HOME, { recursive: true, force: true });
      restored.push('providers/secrets');
    }

    const tmpLib = path.join(tmp, 'Documents', 'Codex Library');
    if (fs.existsSync(tmpLib)) {
      const lib = libraryRoot();
      if (fs.existsSync(lib)) {
        fs.cpSync(lib, path.join(backupDir, 'Codex Library'), { recursive: true });
        fs.rmSync(lib, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(lib), { recursive: true });
      fs.cpSync(tmpLib, lib, { recursive: true });
      restored.push('library');
    }
    return { ok: true, archive: src, restored, backupDir, entries: entries.length };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
