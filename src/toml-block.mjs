// Minimal, surgical TOML editing: we never rewrite the user's file wholesale.
// We only replace clearly delimited managed blocks and root-level keys we own.

const blockStart = (id) => `# >>> cfm:${id}`;
const blockEnd = (id) => `# <<< cfm:${id}`;

export function upsertBlock(text, id, body) {
  const start = blockStart(id);
  const end = blockEnd(id);
  const block = [start, body.trimEnd(), end].join('\n') + '\n';
  const src = text || '';
  const i = src.indexOf(start);
  if (i === -1) return (src.trimEnd() ? src.trimEnd() + '\n\n' : '') + block;
  const j = src.indexOf(end, i);
  if (j === -1) return src.slice(0, i) + block;
  return src.slice(0, i) + block + src.slice(j + end.length).replace(/^\n/, '');
}

export function removeBlock(text, id) {
  const src = text || '';
  const i = src.indexOf(blockStart(id));
  if (i === -1) return src;
  const j = src.indexOf(blockEnd(id), i);
  if (j === -1) return src;
  return (src.slice(0, i) + src.slice(j + blockEnd(id).length)).replace(/\n{3,}/g, '\n\n');
}

// TOML root keys must appear before the first table header. Remove only keys
// that are outside any [table] and outside our managed blocks.
export function withoutRootKeys(text, keys) {
  const wanted = new Set(keys);
  const out = [];
  let inTable = false;
  let inManaged = false;
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (t.startsWith('# >>> cfm:')) { inManaged = true; out.push(line); continue; }
    if (t.startsWith('# <<< cfm:')) { inManaged = false; out.push(line); continue; }
    if (!inManaged && /^\[/.test(t)) inTable = true;
    if (!inManaged && !inTable) {
      const m = t.match(/^([A-Za-z0-9_.-]+)\s*=/);
      if (m && wanted.has(m[1])) continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export function setRootKeys(text, entries) {
  const keys = Object.keys(entries);
  let src = withoutRootKeys(text, keys);
  // drop an existing defaults block so key order stays deterministic
  src = removeBlock(src, 'defaults');
  const body = keys.map((k) => `${k} = ${tomlValue(entries[k])}`).join('\n');
  const block = [blockStart('defaults'), body, blockEnd('defaults')].join('\n') + '\n';
  // Root keys must precede the first table header.
  return block + (src.trim() ? '\n' + src.trimStart() : '');
}

export function tomlValue(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return JSON.stringify(String(v));
}

export function tomlTable(obj, header) {
  const lines = [`[${header}]`];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${k} = { ${Object.entries(v).map(([kk, vv]) => `${JSON.stringify(kk)} = ${tomlValue(vv)}`).join(', ')} }`);
    } else {
      lines.push(`${k} = ${tomlValue(v)}`);
    }
  }
  return lines.join('\n');
}
