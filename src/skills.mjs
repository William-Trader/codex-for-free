import fs from 'node:fs';
import path from 'node:path';
import { CODEX_HOME, SKILLS_DIR, PLUGINS_DIR } from './paths.mjs';

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

export function listSkills() {
  const skills = findSkills(SKILLS_DIR).sort((a, b) => a.name.localeCompare(b.name));
  let plugins = [];
  try {
    plugins = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => ({ name: e.name, path: path.join(PLUGINS_DIR, e.name) }));
  } catch {}
  let marketplaces = [];
  try {
    const cfg = fs.readFileSync(path.join(CODEX_HOME, 'config.toml'), 'utf8');
    marketplaces = [...cfg.matchAll(/^\[marketplaces\.([^\]]+)\]/gm)].map((m) => m[1]);
  } catch {}
  return { skills, plugins, marketplaces, skillsDir: SKILLS_DIR, pluginsDir: PLUGINS_DIR };
}
