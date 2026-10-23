import fs from 'node:fs';
import path from 'node:path';
import { OFFICIAL_CODEX_HOME, OFFICIAL_CONFIG_PATH, HOME } from './paths.mjs';

const ROOT_KEYS = new Set([
  'model', 'model_provider', 'model_catalog_json', 'model_reasoning_effort',
  'model_context_window', 'model_max_output_tokens'
]);

export function officialHasCfm() {
  try {
    const s = fs.readFileSync(OFFICIAL_CONFIG_PATH, 'utf8');
    return /# >>> cfm:/.test(s) || /^model_catalog_json\s*=.*codex-for-mac/m.test(s) || /\[model_providers\.deepseek\]/.test(s);
  } catch { return false; }
}

export function restoreOfficialConfig() {
  if (!fs.existsSync(OFFICIAL_CONFIG_PATH)) return { ok: false, error: '官方 config.toml 不存在' };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = OFFICIAL_CONFIG_PATH + '.bak-cfm-' + stamp;
  const original = fs.readFileSync(OFFICIAL_CONFIG_PATH, 'utf8');
  fs.copyFileSync(OFFICIAL_CONFIG_PATH, backup);
  fs.chmodSync(backup, 0o600);

  // remove managed blocks
  let s = original.replace(/# >>> cfm:[\s\S]*?# <<< cfm:[^\n]*\n?/g, '');

  // remove our deepseek provider section (until next table header)
  const lines = s.split('\n');
  const kept = [];
  let skip = false;
  let sawTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('[')) {
      sawTable = true;
      skip = t === '[model_providers.deepseek]';
      if (skip) continue;
    }
    if (skip) continue;
    if (!sawTable) {
      const m = t.match(/^([A-Za-z0-9_.-]+)\s*=/);
      if (m && ROOT_KEYS.has(m[1])) continue;
    }
    kept.push(line);
  }
  s = kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(OFFICIAL_CONFIG_PATH, s, { mode: 0o600 });
  try { fs.chmodSync(OFFICIAL_CONFIG_PATH, 0o600); } catch {}

  for (const f of ['deepseek-models.json']) {
    const p = path.join(OFFICIAL_CODEX_HOME, f);
    try { if (fs.existsSync(p)) fs.rmSync(p); } catch {}
  }
  return { ok: true, backup, before: original.length, after: s.length, hasCfm: officialHasCfm() };
}
