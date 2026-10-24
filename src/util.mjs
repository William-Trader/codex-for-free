import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (v >= 10 || i === 0 ? v.toFixed(0) : v.toFixed(1)) + ' ' + u[i];
}

export function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
  try { fs.chmodSync(dir, mode); } catch {}
  return dir;
}

export function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

export function dirSize(dir) {
  let total = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try { total += fs.statSync(p).size; files++; } catch {}
      }
    }
  }
  return { bytes: total, files };
}

export function which(bin) {
  if (!bin) return null;
  const isWin = process.platform === 'win32';
  if (bin.includes('/') || (isWin && bin.includes('\\'))) return fs.existsSync(bin) ? bin : null;
  // Windows resolves executables through PATHEXT; "codex" alone never exists on disk.
  const exts = isWin
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const names = isWin && !path.extname(bin) ? [bin, ...exts.map((e) => bin + e.toLowerCase()), ...exts.map((e) => bin + e)] : [bin];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    for (const name of names) {
      const p = path.join(d, name);
      try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
    }
  }
  return null;
}

// Windows has no POSIX mode bits: an equivalent of 0600 is an ACL that grants
// only the current user. Failure is non-fatal (a non-NTFS volume cannot carry it).
export function lockFileAcl(target) {
  if (process.platform !== 'win32' || !target) return false;
  const user = process.env.USERNAME;
  if (!user) return false;
  const r = spawnSync('icacls', [target, '/inheritance:r', '/grant:r', `${user}:F`], { encoding: 'utf8' });
  return r.status === 0;
}

export function lockDirAcl(target) {
  return lockFileAcl(target);
}

// Reads the effective ACL. Windows has no 0600, so "private" means: no
// inherited entries and no grant to Everyone / Users / Authenticated Users.
export function aclIsPrivate(target) {
  if (process.platform !== 'win32') return null;
  const r = spawnSync('icacls', [target], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const text = (r.stdout || '') + (r.stderr || '');
  const shared = /(Everyone|BUILTIN\\Users|NT AUTHORITY\\Authenticated Users|:(I))/i.test(text);
  return !shared;
}

export function openPath(target, { reveal = false } = {}) {
  const plat = process.platform;
  if (plat === 'win32') {
    const args = reveal ? ['/select,', target] : [target];
    return spawnSync('explorer.exe', args, { encoding: 'utf8' });
  }
  if (plat === 'darwin') {
    return spawnSync('open', reveal ? ['-R', target] : [target], { encoding: 'utf8' });
  }
  return spawnSync('xdg-open', [target], { encoding: 'utf8' });
}

export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message || r.error) : null
  };
}

export function redact(text) {
  if (!text) return text;
  return String(text)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, 'sk-***')
    .replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]{12,}\b/g, '$1***')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA***')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]{12,}/gi, '$1***')
    .replace(/(api[_-]?key\s*[=:]\s*)[^\s"']{8,}/gi, '$1***');
}

export function slugify(s, max = 48) {
  const out = String(s || 'untitled')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return out || 'untitled';
}

export function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

export function iso(d = new Date()) { return d.toISOString(); }

export function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

export function writeJson(p, value, mode = 0o600) {
  ensureDir(path.dirname(p), 0o700);
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { mode });
  try { fs.chmodSync(p, mode); } catch {}
}

export function platform() {
  return { os: os.platform(), arch: os.arch(), release: os.release(), node: process.version };
}
