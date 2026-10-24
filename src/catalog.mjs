import fs from 'node:fs';
import path from 'node:path';
import { locateCodex, CATALOG_DIR } from './paths.mjs';
import { run, ensureDir, readJson } from './util.mjs';

const LEVELS = {
  low: 'Fast responses with lighter reasoning',
  medium: 'Balances speed and reasoning depth for everyday tasks',
  high: 'Greater reasoning depth for complex problems',
  xhigh: 'Extra-high reasoning depth',
  max: 'Maximum reasoning depth for the hardest problems'
};

export function reasoningLevels(list, fallback) {
  const wanted = (list && list.length ? list : (fallback || ['low', 'medium', 'high'])).filter((x) => LEVELS[x]);
  return wanted.map((effort) => ({ effort, description: LEVELS[effort] }));
}

// Keep tool output usable: 10k tokens wastes a 1M-token window.
export function truncationLimit(context) {
  if (context >= 400000) return 60000;
  if (context >= 128000) return 20000;
  return 10000;
}

function minimalTemplate(slug, name, context) {
  return {
    slug,
    display_name: name,
    description: 'Custom model provided by codex-for-mac.',
    default_reasoning_level: 'medium',
    supported_reasoning_levels: reasoningLevels(),
    shell_type: 'unified_exec',
    visibility: 'list',
    supported_in_api: true,
    priority: 1,
    context_window: context,
    max_context_window: context,
    effective_context_window_percent: 95,
    input_modalities: ['text'],
    supports_reasoning_effort_updates: true,
    tool_mode: 'default',
    base_instructions: 'You are a coding agent running inside Codex. Work in the user workspace and follow the user request precisely.',
    model_messages: { instructions_template: 'You are a coding agent running inside Codex.' }
  };
}

function bundledTemplate() {
  const bin = locateCodex();
  if (!bin) return null;
  const r = run(bin, ['debug', 'models', '--bundled'], { timeout: 30000 });
  if (!r.ok) return null;
  try {
    const cat = JSON.parse(r.stdout);
    const models = Array.isArray(cat) ? cat : cat.models;
    if (!Array.isArray(models) || !models.length) return null;
    return models.find((m) => m.slug === 'gpt-5.5') || models[models.length - 1];
  } catch { return null; }
}

export function makeCatalog(providerId, models) {
  const tpl = bundledTemplate();
  const entries = models.map((m, i) => {
    const ctx = Number(m.context) || 131072;
    const base = tpl ? JSON.parse(JSON.stringify(tpl)) : minimalTemplate(m.id, m.name, ctx);
    base.slug = m.id;
    base.display_name = m.name || m.id;
    base.description = m.description || 'Custom model provided by codex-for-mac.';
    base.priority = i + 1;
    base.context_window = ctx;
    base.max_context_window = Number(m.maxContext) || ctx;
    base.effective_context_window_percent = 95;
    base.input_modalities = Array.isArray(m.inputModalities) && m.inputModalities.length ? m.inputModalities : ['text'];
    base.truncation_policy = { mode: 'tokens', limit: truncationLimit(ctx) };
    base.visibility = 'list';
    base.supported_in_api = true;
    base.upgrade = null;
    const levels = reasoningLevels(m.reasoning, m.defaultEffort && [m.defaultEffort]);
    base.supported_reasoning_levels = levels;
    const preferred = m.defaultEffort && levels.some((l) => l.effort === m.defaultEffort)
      ? m.defaultEffort
      : (levels.some((l) => l.effort === 'medium') ? 'medium' : levels[0].effort);
    base.default_reasoning_level = preferred;
    base.supports_reasoning_effort_updates = true;
    return base;
  });
  return { models: entries };
}

export function buildCatalog(providerId, models) {
  ensureDir(CATALOG_DIR, 0o700);
  const out = path.join(CATALOG_DIR, `${providerId}.json`);
  const cat = makeCatalog(providerId, models);
  fs.writeFileSync(out, JSON.stringify(cat, null, 2) + '\n', { mode: 0o600 });
  try { fs.chmodSync(out, 0o600); } catch {}
  return { path: out, count: cat.models.length, source: locateCodex() ? 'bundled-template' : 'minimal' };
}

export function readCatalog(providerId) {
  return readJson(path.join(CATALOG_DIR, `${providerId}.json`), null);
}
