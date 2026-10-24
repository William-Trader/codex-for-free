// Structural TOML checks that do not need a parser dependency.
// Codex refuses to start when a root key or a table header is declared twice,
// which is exactly the failure mode a surgical config edit can introduce.

export function lintToml(text) {
  const errors = [];
  const rootKeys = new Map();
  const tables = new Map();
  const seen = new Map();
  let table = null;
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    if (t.startsWith('[')) {
      const m = t.match(/^\[\[?([^\]]+)\]\]?/);
      if (!m) { errors.push({ line: lineNo, type: 'bad-header', message: 'unterminated table header' }); return; }
      const name = m[1].trim();
      if (tables.has(name)) errors.push({ line: lineNo, type: 'duplicate-table', name, first: tables.get(name), message: `table [${name}] declared twice` });
      else tables.set(name, lineNo);
      table = name;
      return;
    }
    const kv = t.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (!kv) return;
    const key = kv[1];
    const full = table ? table + '.' + key : key;
    if (seen.has(full)) errors.push({ line: lineNo, type: 'duplicate-key', name: full, first: seen.get(full), message: `key ${full} declared twice` });
    else seen.set(full, lineNo);
    if (!table) rootKeys.set(key, lineNo);
  });
  return {
    ok: errors.length === 0,
    errors,
    rootKeys: [...rootKeys.keys()],
    tables: [...tables.keys()]
  };
}

// The four root keys Codex needs for a custom provider; each must appear once.
export const REQUIRED_ROOT_KEYS = ['model', 'model_provider', 'model_catalog_json', 'model_reasoning_effort'];

export function checkCodexConfig(text) {
  const lint = lintToml(text);
  const missing = REQUIRED_ROOT_KEYS.filter((k) => !lint.rootKeys.includes(k));
  return { ...lint, ok: lint.ok && missing.length === 0, missing };
}
