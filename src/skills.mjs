import fs from 'node:fs';
import path from 'node:path';
import { CODEX_HOME, OFFICIAL_CODEX_HOME, SKILLS_DIR, PLUGINS_DIR } from './paths.mjs';

function frontmatter(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return {};
    const out = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch { return {}; }
}

function findSkills(dir, depth = 0) {
  const out = [];
  if (depth > 3) return out;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === 'SKILL.md') {
      const fm = frontmatter(p);
      out.push({ name: fm.name || path.basename(dir), description: fm.description || '', path: p });
    } else if (e.isDirectory()) {
      out.push(...findSkills(p, depth + 1));
    }
  }
  return out;
}

function readPlugins(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => ({ name: e.name, path: path.join(dir, e.name) }));
  } catch { return []; }
}

function marketplaces(file) {
  try {
    const cfg = fs.readFileSync(file, 'utf8');
    return [...cfg.matchAll(/^\[marketplaces\.([^\]]+)\]/gm)].map((m) => m[1]);
  } catch { return []; }
}

export function listSkills() {
  const freeSkills = findSkills(SKILLS_DIR).map((s) => ({ ...s, source: 'free' }));
  const officialSkillsDir = path.join(OFFICIAL_CODEX_HOME, 'skills');
  const officialSkills = findSkills(officialSkillsDir).map((s) => ({ ...s, source: 'official' }));
  const skills = [...freeSkills, ...officialSkills].sort((a, b) => a.name.localeCompare(b.name));
  const freePlugins = readPlugins(PLUGINS_DIR).map((p) => ({ ...p, source: 'free' }));
  const officialPluginsDir = path.join(OFFICIAL_CODEX_HOME, 'plugins');
  const officialPlugins = readPlugins(officialPluginsDir).map((p) => ({ ...p, source: 'official' }));
  const plugins = [...freePlugins, ...officialPlugins];
  const marks = [
    ...marketplaces(path.join(CODEX_HOME, 'config.toml')).map((name) => ({ name, source: 'free' })),
    ...marketplaces(path.join(OFFICIAL_CODEX_HOME, 'config.toml')).map((name) => ({ name, source: 'official' }))
  ];
  return {
    skills, plugins, marketplaces: marks,
    skillsDir: SKILLS_DIR, pluginsDir: PLUGINS_DIR,
    homes: { free: CODEX_HOME, official: OFFICIAL_CODEX_HOME }
  };
}
