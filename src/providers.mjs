import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_PATH, REGISTRY_PATH, SECRETS_DIR, CATALOG_DIR, CFM_HOME
} from './paths.mjs';
import { readJson, writeJson, ensureDir, redact } from './util.mjs';
import { setRootKeys, upsertBlock, tomlTable, withoutRootKeys } from './toml-block.mjs';
import { buildCatalog } from './catalog.mjs';

export const PRESETS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
    docs: 'https://platform.deepseek.com',
    verified: true,
    models: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', context: 1048576, reasoning: ['low', 'medium', 'high', 'max'] },
      { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', context: 1048576, reasoning: ['low', 'medium', 'high', 'max'] }
    ]
  },
  qwen: {
    name: 'Qwen (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    docs: 'https://help.aliyun.com/zh/model-studio/',
    verified: false,
    models: [
      { id: 'qwen3-max', name: 'Qwen3 Max', context: 262144, reasoning: ['low', 'medium', 'high'] },
      { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus', context: 262144, reasoning: ['low', 'medium', 'high'] },
      { id: 'qwen-plus', name: 'Qwen Plus', context: 131072, reasoning: ['low', 'medium', 'high'] },
      { id: 'qwen-turbo', name: 'Qwen Turbo', context: 131072, reasoning: ['low', 'medium'] }
    ]
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    envKey: 'MOONSHOT_API_KEY',
    docs: 'https://platform.moonshot.cn',
    verified: false,
    models: [
      { id: 'kimi-k2.5', name: 'Kimi K2.5', context: 262144, reasoning: ['low', 'medium', 'high'] },
      { id: 'kimi-k2-0905-preview', name: 'Kimi K2', context: 262144, reasoning: ['low', 'medium', 'high'] }
    ]
  },
  zhipu: {
    name: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    envKey: 'ZHIPU_API_KEY',
    docs: 'https://open.bigmodel.cn',
    verified: false,
    models: [
      { id: 'glm-4.6', name: 'GLM-4.6', context: 204800, reasoning: ['low', 'medium', 'high'] },
      { id: 'glm-4.5-air', name: 'GLM-4.5 Air', context: 131072, reasoning: ['low', 'medium'] }
    ]
  },
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    envKey: 'MINIMAX_API_KEY',
    docs: 'https://platform.minimaxi.com',
    verified: false,
    models: [
      { id: 'MiniMax-M2', name: 'MiniMax M2', context: 204800, reasoning: ['low', 'medium', 'high'] }
    ]
  },
  'openai-compatible': {
    name: 'OpenAI-compatible',
    baseUrl: '',
    envKey: 'CFM_PROVIDER_API_KEY',
    docs: '',
    verified: false,
    models: []
  }
};

export function loadRegistry() {
  const r = readJson(REGISTRY_PATH, null);
  if (r && r.providers) return r;
  return { providers: {} };
}

export function saveRegistry(reg) {
  writeJson(REGISTRY_PATH, reg, 0o600);
  return reg;
}

export function secretPath(id) { return path.join(SECRETS_DIR, `${id}.key`); }
export function hasSecret(id) {
  try { return fs.statSync(secretPath(id)).size > 0; } catch { return false; }
}
export function readSecret(id) {
  try { return fs.readFileSync(secretPath(id), 'utf8').trim(); } catch { return null; }
}
export function saveSecret(id, key) {
  if (!key || !String(key).trim()) throw new Error('empty api key');
  ensureDir(SECRETS_DIR, 0o700);
  fs.writeFileSync(secretPath(id), String(key).trim() + '\n', { mode: 0o600 });
  try { fs.chmodSync(secretPath(id), 0o600); } catch {}
  return secretPath(id);
}

export function parseModels(input) {
  if (!input) return [];
  return String(input).split(',').map((s) => s.trim()).filter(Boolean).map((id) => ({
    id, name: id, context: 131072, reasoning: ['low', 'medium', 'high']
  }));
}

export function addProvider({ presetId, id, baseUrl, models, key }) {
  const preset = PRESETS[presetId];
  if (!preset) throw new Error(`unknown preset: ${presetId}`);
  const pid = id || presetId;
  const list = models && models.length ? models : preset.models;
  if (!list.length) throw new Error('no models: pass --models a,b');
  const url = baseUrl || preset.baseUrl;
  if (!url) throw new Error('base url required for openai-compatible');
  if (key) saveSecret(pid, key);
  const reg = loadRegistry();
  reg.providers[pid] = {
    id: pid,
    preset: presetId,
    name: preset.name,
    baseUrl: url,
    envKey: preset.envKey,
    models: list,
    addedAt: new Date().toISOString()
  };
  saveRegistry(reg);
  return reg.providers[pid];
}

export function providerToml(provider) {
  const key = readSecret(provider.id);
  const table = {
    name: provider.name,
    base_url: provider.baseUrl,
    wire_api: 'responses'
  };
  if (key) table.http_headers = { Authorization: `Bearer ${key}` };
  else table.env_key = provider.envKey;
  return tomlTable(table, `model_providers.${provider.id}`);
}

export function useProvider(id, { model, effort } = {}) {
  const reg = loadRegistry();
  const provider = reg.providers[id];
  if (!provider) throw new Error(`provider not registered: ${id}`);
  const chosen = model || provider.models[0]?.id;
  if (!chosen) throw new Error('provider has no models');
  const cat = buildCatalog(id, provider.models);
  let cfg = '';
  try { cfg = fs.readFileSync(CONFIG_PATH, 'utf8'); } catch {}
  cfg = upsertBlock(cfg, `provider:${id}`, providerToml(provider));
  cfg = withoutRootKeys(cfg, ['model_context_window', 'model_max_output_tokens']);
  const effortValue = effort || 'medium';
  cfg = setRootKeys(cfg, {
    model: chosen,
    model_provider: id,
    model_catalog_json: cat.path,
    model_reasoning_effort: effortValue
  });
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, cfg, { mode: 0o600 });
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch {}
  return { provider, model: chosen, effort: effortValue, catalog: cat };
}

export async function testProvider(id, fetchImpl = fetch) {
  const reg = loadRegistry();
  const p = reg.providers[id];
  if (!p) throw new Error(`provider not registered: ${id}`);
  const key = readSecret(id);
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  const base = p.baseUrl.replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetchImpl(base + '/models', { headers, signal: ctrl.signal });
    const text = await res.text();
    let count = null;
    try { const j = JSON.parse(text); count = Array.isArray(j.data) ? j.data.length : null; } catch {}
    const model = p.models[0]?.id;
    let responses = { ok: false, status: null };
    if (model) {
      const r2 = await fetchImpl(base + '/responses', {
        method: 'POST', headers, signal: ctrl.signal,
        body: JSON.stringify({ model, input: 'ping', max_output_tokens: 8 })
      });
      responses = { ok: r2.ok, status: r2.status };
    }
    return {
      ok: responses.ok, status: res.status, modelCount: count,
      models: { status: res.status, ok: res.ok },
      responses, baseUrl: p.baseUrl
    };
  } finally { clearTimeout(t); }
}

export function normalizeKey(raw) {
  let k = String(raw || '').trim().replace(/^Bearer\s+/i, '').trim();
  if (!k) throw new Error('请填写 API key');
  if (k.length < 8 || k.length > 4096) throw new Error('API key 长度不合法');
  if (/[\s\u0000-\u001f]/.test(k)) throw new Error('API key 含空白或控制字符');
  return k;
}

export function validateBaseUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { throw new Error('Base URL 不合法'); }
  if (u.username || u.password) throw new Error('Base URL 不能包含用户名或密码');
  if (u.protocol !== 'https:') {
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
    if (!(u.protocol === 'http:' && local)) throw new Error('只允许 https://，或本机 http://localhost');
  }
  u.hash = '';
  u.search = '';
  return u.toString().replace(/\/$/, '');
}

export async function testConnection({ baseUrl, key, model, fetchImpl = fetch }) {
  const k = normalizeKey(key);
  const base = validateBaseUrl(baseUrl);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${k}` };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const models = { ok: false, status: null, count: null };
    try {
      const r = await fetchImpl(base + '/models', { headers, signal: ctrl.signal });
      models.status = r.status;
      models.ok = r.ok;
      const text = await r.text();
      try { const j = JSON.parse(text); models.count = Array.isArray(j.data) ? j.data.length : null; } catch {}
    } catch {}
    let responses = { ok: false, status: null };
    if (model) {
      try {
        const r2 = await fetchImpl(base + '/responses', {
          method: 'POST', headers, signal: ctrl.signal,
          body: JSON.stringify({ model, input: 'ping', max_output_tokens: 8 })
        });
        responses = { ok: r2.ok, status: r2.status };
      } catch {}
    }
    return { ok: responses.ok, baseUrl: base, models, responses, model };
  } finally { clearTimeout(t); }
}

export async function onboardProvider({ presetId, id, key, baseUrl, models, model, effort, fetchImpl = fetch }) {
  const preset = PRESETS[presetId];
  if (!preset) throw new Error(`未知供应商预设: ${presetId}`);
  const k = normalizeKey(key);
  const url = validateBaseUrl(baseUrl || preset.baseUrl);
  const list = models && models.length ? models : preset.models;
  if (!list.length) throw new Error('请至少提供一个模型 ID');
  const chosen = model || list[0].id;
  if (!list.some((m) => m.id === chosen)) throw new Error('选择的模型不在模型列表中');
  const test = await testConnection({ baseUrl: url, key: k, model: chosen, fetchImpl });
  if (!test.responses.ok) {
    throw new Error(`该端点 /responses 返回 ${test.responses.status ?? '不可达'}，Codex 需要 Responses API，未保存`);
  }
  const pid = id || presetId;
  addProvider({ presetId, id: pid, baseUrl: url, models: list, key: k });
  const used = useProvider(pid, { model: chosen, effort });
  return { provider: pid, model: chosen, effort: used.effort, test };
}

export function listProviders() {
  const reg = loadRegistry();
  return Object.values(reg.providers).map((p) => ({
    id: p.id, name: p.name, baseUrl: p.baseUrl,
    models: p.models.map((m) => m.id), hasKey: hasSecret(p.id), preset: p.preset
  }));
}
