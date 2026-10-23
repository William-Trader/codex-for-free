import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, redact } from './util.mjs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));
const REPO = 'William-Trader/codex-for-free';

function verParts(v) {
  return String(v || '').replace(/^v/i, '').split('.').map((s) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

export function compareVersions(a, b) {
  const A = verParts(a);
  const B = verParts(b);
  const L = Math.max(A.length, B.length);
  for (let i = 0; i < L; i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export async function checkForUpdates({ fetchImpl = fetch } = {}) {
  const current = pkg.version;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'codex-for-free' }
    });
    if (!res.ok) {
      return { current, latest: current, outdated: false, url: '', error: `检查更新失败（HTTP ${res.status}）` };
    }
    const j = await res.json();
    const latest = String(j.tag_name || '').replace(/^v/i, '') || current;
    return {
      current,
      latest,
      outdated: compareVersions(latest, current) > 0,
      url: j.html_url || '',
      notes: j.name || ''
    };
  } catch {
    return { current, latest: current, outdated: false, url: '', error: '无法连接更新服务（中国大陆用户需使用代理）' };
  } finally {
    clearTimeout(t);
  }
}

export function updateNow() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = run(npm, ['install', '-g', 'codex-for-free@latest'], { timeout: 180000 });
  return {
    ok: r.ok,
    status: r.status,
    stdout: redact(r.stdout),
    stderr: redact(r.stderr)
  };
}
