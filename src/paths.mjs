import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { which } from './util.mjs';

export const HOME = os.homedir();
export const IS_WINDOWS = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';
export const LOCAL_APP_DATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
export const PROGRAM_FILES = process.env.ProgramFiles || path.join('C:', 'Program Files');
export const OFFICIAL_CODEX_HOME = process.env.OFFICIAL_CODEX_HOME || path.join(HOME, '.codex');

// The live GPT frontend reads ~/.codex. Older installs used ~/.codex-for-free.
// Pick whichever directory actually holds conversation history, preferring the live one.
function hasThreads(dir) {
  try { return fs.statSync(path.join(dir, 'thread_history_1.sqlite')).size > 64 * 1024; } catch { return false; }
}

function pickCodexHome() {
  const override = process.env.CFM_CODEX_HOME || process.env.CODEX_HOME;
  if (override) return override;
  const live = path.join(HOME, '.codex');
  const legacy = path.join(HOME, '.codex-for-free');
  for (const dir of [live, legacy]) if (hasThreads(dir)) return dir;
  for (const dir of [live, legacy]) if (fs.existsSync(dir)) return dir;
  return live;
}

export const CODEX_HOME = pickCodexHome();
// Keep the macOS directory name on every platform so the two ports do not fork
// their data layout: only the home prefix differs.
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

// Windows CLI shim lives in a per-user directory; no administrator rights needed.
export const CFM_BIN_DIR = process.env.CFM_BIN_DIR || path.join(LOCAL_APP_DATA, 'Programs', 'cfm');

const BUNDLED_CODEX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'codex-cli', 'bin', IS_WINDOWS ? 'codex.exe' : 'codex');

// The Windows desktop app ships the CLI under bin/<build-hash>/codex.exe.
// Pick the newest build so an app update is followed automatically.
function windowsCliBins() {
  const found = [];
  const roots = [
    path.join(LOCAL_APP_DATA, 'OpenAI', 'Codex', 'bin'),
    path.join(LOCAL_APP_DATA, 'Programs', 'Codex', 'bin'),
    path.join(LOCAL_APP_DATA, 'Programs', 'codex', 'bin')
  ];
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const bin = path.join(root, ent.name, 'codex.exe');
      try {
        const st = fs.statSync(bin);
        if (st.isFile()) found.push({ bin, mtime: st.mtimeMs });
      } catch {}
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found.map((x) => x.bin);
}

function installedAppBins() {
  const found = [];
  if (IS_WINDOWS) return found;
  for (const base of ['/Applications', path.join(HOME, 'Applications')]) {
    let entries = [];
    try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory() || !ent.name.endsWith('.app')) continue;
      found.push(path.join(base, ent.name, 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'));
    }
  }
  return found;
}

export function locateCodex() {
  const macCandidates = IS_WINDOWS ? [] : [
    BUNDLED_CODEX,
    '/Applications/Codex for Free.app/Contents/Resources/codex-cli/bin/codex',
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
    '/Applications/Codex.app/Contents/Resources/codex-cli/bin/codex',
    path.join(HOME, 'Applications', 'Codex for Free.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
    path.join(HOME, 'Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex')
  ];
  const winCandidates = IS_WINDOWS ? [
    BUNDLED_CODEX,
    ...windowsCliBins(),
    path.join(LOCAL_APP_DATA, 'OpenAI', 'Codex', 'codex.exe'),
    path.join(LOCAL_APP_DATA, 'Programs', 'Codex', 'codex.exe'),
    path.join(LOCAL_APP_DATA, 'Programs', 'codex', 'codex.exe'),
    path.join(PROGRAM_FILES, 'Codex', 'codex.exe'),
    path.join(PROGRAM_FILES, 'OpenAI', 'Codex', 'codex.exe'),
    which('codex'),
    which('codex.exe')
  ] : [];
  const candidates = [
    process.env.CODEX_BIN,
    ...winCandidates,
    ...macCandidates,
    ...installedAppBins(),
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
