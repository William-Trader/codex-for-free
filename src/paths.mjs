import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { which } from './util.mjs';

export const HOME = os.homedir();
export const OFFICIAL_CODEX_HOME = process.env.OFFICIAL_CODEX_HOME || path.join(HOME, '.codex');
export const CODEX_HOME = process.env.CFM_CODEX_HOME || process.env.CODEX_HOME || path.join(HOME, '.codex-for-free');
export const CFM_HOME = process.env.CFM_HOME || path.join(HOME, '.codex-for-mac');
export const CONFIG_PATH = path.join(CODEX_HOME, 'config.toml');
export const OFFICIAL_CONFIG_PATH = path.join(OFFICIAL_CODEX_HOME, 'config.toml');
export const STATE_DB = path.join(CODEX_HOME, 'state_5.sqlite');
export const LOGS_DB = path.join(CODEX_HOME, 'logs_2.sqlite');
export const THREAD_HISTORY_DB = path.join(CODEX_HOME, 'thread_history_1.sqlite');
export const SESSIONS_DIR = path.join(CODEX_HOME, 'sessions');
export const SKILLS_DIR = path.join(CODEX_HOME, 'skills');
export const PLUGINS_DIR = path.join(CODEX_HOME, 'plugins');
export const SECRETS_DIR = path.join(CFM_HOME, 'secrets');
export const CATALOG_DIR = path.join(CFM_HOME, 'catalog');
export const ARCHIVE_DIR = path.join(CFM_HOME, 'archive');
export const REGISTRY_PATH = path.join(CFM_HOME, 'providers.json');
export const CFM_CONFIG_PATH = path.join(CFM_HOME, 'config.json');
export const DEFAULT_LIBRARY = path.join(HOME, 'Documents', 'Codex Library');

const BUNDLED_CODEX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'codex-cli', 'bin', 'codex');

export function locateCodex() {
  const candidates = [
    process.env.CODEX_BIN,
    BUNDLED_CODEX,
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
    '/Applications/Codex.app/Contents/Resources/codex-cli/bin/codex',
    path.join(HOME, 'Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
    path.join(HOME, 'Applications', 'ChatGPT-official.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
    which('codex')
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

export function cfmConfig() {
  try { return JSON.parse(fs.readFileSync(CFM_CONFIG_PATH, 'utf8')); } catch { return {}; }
}

export function saveCfmConfig(patch) {
  const cur = cfmConfig();
  const next = { ...cur, ...patch };
  fs.mkdirSync(CFM_HOME, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CFM_CONFIG_PATH, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  return next;
}
