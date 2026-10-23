import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CODEX_HOME, OFFICIAL_CODEX_HOME, OFFICIAL_CONFIG_PATH, CFM_HOME, CONFIG_PATH, CFM_CONFIG_PATH, HOME, locateCodex
} from './paths.mjs';
import { officialHasCfm, restoreOfficialConfig } from './isolate.mjs';
import { fmtBytes, platform, redact } from './util.mjs';
import { storageReport, vacuumAll, archiveOldSessions, folderReport } from './storage.mjs';
import {
  exportLibrary, readLibrary, libraryRoot, setLibraryRoot, libraryStats
} from './library.mjs';
import { listSkills } from './skills.mjs';
import {
  PRESETS, addProvider, useProvider, listProviders, testProvider,
  loadRegistry, hasSecret, secretPath, parseModels, readSecret
} from './providers.mjs';
import { buildCatalog } from './catalog.mjs';
import { checkForUpdates, updateNow } from './update.mjs';
import { startServer } from './server.mjs';
import { searchLibrary, createBackup, restoreBackup } from './maintenance.mjs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

function parseArgs(args) {
  const f = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { f[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const k = a.slice(2);
      if (args[i + 1] && !args[i + 1].startsWith('--')) f[k] = args[++i];
      else f[k] = true;
    } else f._.push(a);
  }
  return f;
}

function out(...a) { console.log(...a); }
function jsonOut(v) { console.log(JSON.stringify(v, null, 2)); }
function head(t) { out('\n' + t); }

function readHidden(label) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) { resolve(fs.readFileSync(0, 'utf8').trim()); return; }
    process.stdout.write(label);
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let buf = '';
    const done = (val) => {
      stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData);
      process.stdout.write('\n'); resolve(val);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(buf);
        if (ch === '\u0003') { stdin.setRawMode(false); process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f') { buf = buf.slice(0, -1); continue; }
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function resolveKey(flags, preset) {
  if (flags.key && typeof flags.key === 'string') return flags.key.trim();
  if (process.env.CFM_KEY) return process.env.CFM_KEY.trim();
  if (preset?.envKey && process.env[preset.envKey]) return process.env[preset.envKey].trim();
  if (flags['key-stdin']) return fs.readFileSync(0, 'utf8').trim();
  if (process.stdin.isTTY) return readHidden('API key (输入不回显): ');
  throw new Error('缺少 API key：用 --key-stdin、CFM_KEY 环境变量，或直接运行由终端提示输入');
}

function printProviders() {
  const list = listProviders();
  if (!list.length) { out('还没有注册供应商。示例：cfm providers add deepseek'); return; }
  for (const p of list) {
    out(`- ${p.id}  ${p.name}`);
    out(`  base: ${p.baseUrl}`);
    out(`  models: ${p.models.join(', ')}`);
    out(`  key: ${p.hasKey ? '已保存（600）' : '未保存，使用环境变量 ' + (PRESETS[p.preset]?.envKey || '')}`);
  }
}

function printDoctor() {
  const plat = platform();
  const bin = locateCodex();
  const report = storageReport();
  const lib = libraryStats();
  const skills = listSkills();
  const provs = listProviders();
  head('环境');
  out(`  macOS ${plat.release} / ${plat.arch} / node ${plat.node}`);
  out(`  Free home    ${CODEX_HOME}`);
  out(`  Official home ${OFFICIAL_CODEX_HOME}`);
  out(`  CFM home     ${CFM_HOME}`);
  out(`  Codex        ${bin || '未找到（设置 CODEX_BIN）'}`);
  if (bin) {
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    out(`  Codex 版本   ${(v.stdout || '').trim() || 'unknown'}`);
  }
  head('本地存储');
  out(`  会话文件     ${report.sessions.files} 个 / ${report.sessions.size}`);
  out(`  数据库       ${Object.keys(report.databases).length} 个 / ${fmtBytes(Object.values(report.databases).reduce((a, b) => a + b.bytes, 0))}`);
  out(`  线程 / 项目  ${report.threads} / ${report.projects}`);
  out(`  已归档批次   ${report.archives}`);
  head('本地对话库');
  out(`  路径         ${lib.root}`);
  out(`  状态         ${lib.exists ? `${lib.projects} 个项目 / ${lib.conversations} 个对话 / ${lib.size}` : '尚未导出'}`);
  head('官方扩展（只读保留）');
  out(`  Skills       ${skills.skills.length}`);
  out(`  Plugins      ${skills.plugins.length}`);
  out(`  Marketplaces ${skills.marketplaces.length}`);
  head('模型供应商');
  out(`  已注册       ${provs.length}`);
  for (const p of provs) out(`    - ${p.id}: ${p.models.join(', ')} ${p.hasKey ? '· key✓' : '· 无 key'}`);

  const warnings = [];
  try {
    const st = fs.statSync(CONFIG_PATH);
    if ((st.mode & 0o777) !== 0o600) warnings.push('config.toml 权限不是 600');
  } catch { warnings.push('config.toml 不存在'); }
  for (const p of provs) {
    if (!p.hasKey) continue;
    try {
      const st = fs.statSync(secretPath(p.id));
      if ((st.mode & 0o777) !== 0o600) warnings.push(`secret ${p.id}.key 权限不是 600`);
    } catch {}
  }
  if (!lib.exists) warnings.push('本地对话库尚未导出：运行 cfm library export');
  if (officialHasCfm()) warnings.push('官方 Codex 配置仍含 CFM 修改：运行 cfm restore-official');
  const folders = folderReport();
  if (folders.missing.length) warnings.push(`${folders.missing.length} 个项目路径不存在`);
  head('检查结果');
  if (!warnings.length) out('  ✓ 未发现明显问题');
  else for (const w of warnings) out('  ! ' + w);
}

function printStorage(report) {
  out(`  总占用       ${report.total}`);
  out(`  会话文件     ${report.sessions.files} 个 / ${report.sessions.size}`);
  for (const [k, v] of Object.entries(report.databases)) out(`  ${k.padEnd(20)} ${v.size}`);
  out(`  线程 / 项目  ${report.threads} / ${report.projects}`);
  out(`  最早 / 最新  ${report.oldest || '-'} → ${report.newest || '-'}`);
  out(`  归档批次     ${report.archives}`);
  out(`  本地库       ${report.library.exists ? report.library.size + ' · ' + report.library.conversations + ' 对话' : '未导出'}`);
}

function printLibrary(idx) {
  out(`  根目录       ${idx.root}`);
  out(`  项目 ${idx.projects.length} / 对话 ${idx.conversations.length}`);
  head('项目');
  for (const p of idx.projects) {
    out(`  - ${p.name}  ${p.missing ? '[路径不存在]' : ''}  ${p.conversations} 个对话`);
    out(`    ${p.path || '(未归属)'}  →  ${path.join(idx.root, p.dir)}`);
  }
  head('最近对话');
  for (const c of idx.conversations.slice(0, 15)) {
    out(`  - ${c.createdAt.slice(0, 10)}  ${c.title}  [${c.projectName}]`);
    out(`    ${path.join(idx.root, c.files.markdown)}`);
  }
}

const APP_PATH = process.env.CFM_APP_PATH || '/Applications/Codex for Free.app';

function configSummary() {
  try {
    const s = fs.readFileSync(CONFIG_PATH, 'utf8');
    return {
      model: (s.match(/^model\s*=\s*"([^"]+)"/m) || [])[1] || null,
      provider: (s.match(/^model_provider\s*=\s*"([^"]+)"/m) || [])[1] || null
    };
  } catch { return { model: null, provider: null }; }
}

function keyFromConfig() {
  try {
    const s = fs.readFileSync(CONFIG_PATH, 'utf8');
    return (s.match(/Authorization\s*=\s*"Bearer\s+([^"]+)"/) || [])[1] || '';
  } catch { return ''; }
}

async function doctorJson() {
  const bin = locateCodex();
  const app = APP_PATH;
  const cfg = configSummary();
  const checks = [];
  let appName = null;
  let appVersion = null;
  let codexVersion = null;
  if (fs.existsSync(app)) {
    const n = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleDisplayName', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' });
    const v = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' });
    appName = (n.stdout || '').trim() || null;
    appVersion = (v.stdout || '').trim() || null;
  } else checks.push({ level: 'error', id: 'app', message: 'Codex for Free.app not found' });
  if (bin) {
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    codexVersion = (v.stdout || '').trim() || null;
  } else checks.push({ level: 'error', id: 'codex', message: 'Codex CLI not found' });
  let configMode = null;
  try {
    configMode = '0' + (fs.statSync(CONFIG_PATH).mode & 0o777).toString(8);
    if ((fs.statSync(CONFIG_PATH).mode & 0o777) !== 0o600) checks.push({ level: 'warn', id: 'config-mode', message: 'config.toml mode is not 600' });
  } catch { checks.push({ level: 'error', id: 'config', message: 'config.toml not found' }); }
  let panel = false;
  try {
    const r = await fetch('http://127.0.0.1:4317/api/summary', { signal: AbortSignal.timeout(600) });
    panel = r.ok;
  } catch {}
  if (!cfg.provider) checks.push({ level: 'warn', id: 'provider', message: 'model_provider is not set' });
  const lib = libraryStats();
  if (!lib.exists) checks.push({ level: 'warn', id: 'library', message: 'library index is missing' });
  return {
    ok: !checks.some((c) => c.level === 'error'),
    version: pkg.version,
    platform: platform(),
    app: { path: app, exists: fs.existsSync(app), name: appName, version: appVersion },
    codex: { path: bin, version: codexVersion },
    config: { path: CONFIG_PATH, mode: configMode, model: cfg.model, provider: cfg.provider },
    panel: { port: 4317, running: panel },
    library: lib,
    providers: listProviders(),
    checks
  };
}

function runRepair() {
  const official = process.env.CHATGPT_APP || '/Applications/ChatGPT.app';
  if (!fs.existsSync(official)) throw new Error('官方 ChatGPT.app 不存在；先安装或更新官方应用');
  let key = '';
  try { key = readSecret('deepseek'); } catch {}
  if (!key) key = keyFromConfig();
  if (!key) throw new Error('找不到 DeepSeek key；先运行 installer/install.sh');
  const installer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'installer', 'install.sh');
  if (!fs.existsSync(installer)) throw new Error('installer/install.sh 不存在');
  const r = spawnSync('zsh', [installer], { env: { ...process.env, CFM_KEY: key }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('安装器修复失败，退出码 ' + r.status);
  return { ok: true, app: APP_PATH, installer };
}

function runUninstall({ yes = false, keepConfig = false } = {}) {
  if (!yes) throw new Error('uninstall requires --yes');
  const app = APP_PATH;
  let moved = null;
  if (fs.existsSync(app)) {
    const trash = path.join(HOME, '.Trash');
    fs.mkdirSync(trash, { recursive: true });
    const dest = path.join(trash, `Codex for Free.app-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15)}`);
    try { fs.renameSync(app, dest); moved = dest; }
    catch {
      const r = spawnSync('trash', [app], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error((r.stderr || 'cannot move app to Trash').trim());
    }
  }
  let restored = null;
  if (!keepConfig) {
    try {
      const dir = path.dirname(CONFIG_PATH);
      const backups = fs.readdirSync(dir).filter((n) => n.startsWith('config.toml.bak-login-')).sort();
      if (backups.length) {
        const latest = path.join(dir, backups[backups.length - 1]);
        if (fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, path.join(dir, 'config.toml.bak-uninstall-' + Date.now()));
        fs.copyFileSync(latest, CONFIG_PATH);
        fs.chmodSync(CONFIG_PATH, 0o600);
        restored = latest;
      }
    } catch {}
  }
  return { ok: true, moved, restored };
}

async function openPanel(port, target = '/?view=panel') {
  const base = `http://127.0.0.1:${port}`;
  try {
    const r = await fetch(base + '/api/summary', { signal: AbortSignal.timeout(1200) });
    if (r.ok) {
      spawn('open', [base + target], { detached: true, stdio: 'ignore' }).unref();
      return;
    }
  } catch {}
  startServer({ port, open: true, openPath: target });
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = parseArgs(rest);
  const wantJson = !!flags.json;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h' || flags.help) {
    out(`codex-for-mac v${pkg.version} — 自主模型扩展 + 本地对话库

用法:
  cfm doctor [--json]                体检（环境/存储/扩展/供应商）
  cfm search <关键词> [--json] [--all] [--limit N] 搜索本地知识库
  cfm backup [--out FILE]            备份 config / providers / 知识库
  cfm restore <archive> --yes        恢复备份（先备份当前状态）
  cfm repair                         官方 app 更新后重做改名与配置
  cfm uninstall --yes [--keep-config] 移走 app 并恢复官方配置
  cfm storage report                 本地存储占用
  cfm storage vacuum [--apply]       压缩 SQLite（WAL checkpoint + VACUUM）
  cfm storage archive --days 90 [--apply]  归档旧会话（只移不删）
  cfm library export [--out DIR] [--force] [--official] 导出结构化对话/项目（--official 读官方库）
  cfm library list                   查看本地对话库
  cfm library open                   在 Finder 打开本地库
  cfm library path | set <dir>       查看/设置本地库位置
  cfm folders                        项目文件夹体检
  cfm skills list                    列出官方 skills / plugins（只读）
  cfm providers list                 已注册模型供应商
  cfm providers add <preset>         添加供应商（deepseek|qwen|kimi|zhipu|minimax|openai-compatible）
  cfm providers use <id> [--model M] [--effort low|medium|high|max]
  cfm providers current              查看当前 provider / model
  cfm providers test [id]            测试 base_url + key（省略 id 测试全部）
  cfm catalog build <id>             重新生成模型目录
  cfm codex [...args]                用当前配置启动官方 Codex CLI
  cfm ui [--port 4317]               启动本地面板（默认打开对话端）
  cfm panel                           只打开管理面板
  cfm knowledge                       打开本地知识库（对话/项目文件）
  cfm completion [zsh|bash]          输出命令补全
  cfm restore-official                从官方 config.toml 移除 CFM 修改
  cfm check                           检查更新
  cfm update                          安装最新版（npm -g codex-for-free@latest）

安全: API key 只写入 ~/.codex-for-mac/secrets/*.key（600），不会出现在仓库或日志。
`);
    return;
  }

  if (cmd === 'version' || flags.version) { out(pkg.version); return; }

  if (cmd === 'doctor') {
    if (wantJson) return jsonOut(await doctorJson());
    printDoctor();
    return;
  }

  if (cmd === 'search') {
    const q = flags._[0] || flags.q;
    if (!q) throw new Error('用法: cfm search <关键词>');
    const r = searchLibrary(q, {
      limit: Number(flags.limit || 100),
      includeJson: !!flags.all,
      includeArchive: !!flags.all
    });
    if (wantJson) return jsonOut(r);
    for (const m of r.matches) out(`${m.path}:${m.line}: ${m.text}`);
    out(`\n${r.total} 个匹配${r.truncated ? '（只显示前 ' + r.matches.length + ' 个）' : ''}`);
    return;
  }

  if (cmd === 'backup') {
    const r = createBackup({ out: typeof flags.out === 'string' ? flags.out : undefined });
    if (wantJson) return jsonOut(r);
    head('备份完成');
    out('  文件  ' + r.path);
    out('  体积  ' + r.size);
    out('  条目  ' + r.entries.join(', '));
    return;
  }

  if (cmd === 'restore') {
    const archive = flags._[0];
    if (!archive) throw new Error('用法: cfm restore <archive> --yes');
    const r = restoreBackup(archive, { yes: !!flags.yes });
    if (wantJson) return jsonOut(r);
    head('恢复完成');
    out('  恢复  ' + r.restored.join(', '));
    out('  当前状态备份  ' + r.backupDir);
    return;
  }

  if (cmd === 'repair') {
    const r = runRepair();
    if (wantJson) return jsonOut(r);
    out('修复完成: ' + r.app);
    return;
  }

  if (cmd === 'uninstall') {
    const r = runUninstall({ yes: !!flags.yes, keepConfig: !!flags['keep-config'] });
    if (wantJson) return jsonOut(r);
    if (r.moved) out('已移走: ' + r.moved);
    if (r.restored) out('已恢复配置: ' + r.restored);
    out('知识库与 provider 数据未删除。');
    return;
  }

  if (cmd === 'storage') {
    const sub = flags._[0];
    if (sub === 'report' || !sub) {
      const r = storageReport();
      if (wantJson) return jsonOut(r);
      printStorage(r); return;
    }
    if (sub === 'vacuum') {
      const r = vacuumAll({ apply: !!flags.apply });
      if (wantJson) return jsonOut(r);
      head(r.applied ? '压缩完成' : '压缩预演（加 --apply 执行）');
      for (const x of r.results) out(`  ${x.file}: ${x.beforeSize} → ${x.afterSize}  省 ${x.savedSize}${x.error ? '  ! ' + x.error : ''}`);
      out(`  合计节省 ${r.totalSavedSize}`);
      if (!r.applied) out('  提示：先在 Codex 里退出相关会话，再执行 --apply。');
      return;
    }
    if (sub === 'archive') {
      const days = Number(flags.days || 90);
      const r = archiveOldSessions({ days, apply: !!flags.apply });
      if (wantJson) return jsonOut(r);
      head(r.applied ? '归档完成' : '归档预演（加 --apply 执行）');
      out(`  早于 ${days} 天: ${r.count} 个文件 / ${r.totalSize}`);
      if (r.dest) out(`  目标: ${r.dest}`);
      if (r.manifest) out(`  清单: ${r.manifest}`);
      for (const w of r.warnings) out('  ! ' + w);
      for (const e of r.errors) out('  ! ' + e.file + ': ' + e.error);
      return;
    }
    throw new Error('storage 子命令: report | vacuum | archive');
  }

  if (cmd === 'library') {
    const sub = flags._[0];
    if (sub === 'export') {
      const r = exportLibrary({ rootDir: flags.out || libraryRoot(), codexHome: flags.official ? OFFICIAL_CODEX_HOME : CODEX_HOME, force: !!flags.force, limit: Number(flags.limit || 0) });
      if (wantJson) return jsonOut(r);
      head('导出完成');
      out(`  目录     ${r.root}`);
      out(`  项目     ${r.projects}`);
      out(`  对话     ${r.conversations}（跳过 ${r.skipped}，缺失源 ${r.missing}）`);
      out(`  体积     ${r.size}`);
      out(`  索引     ${r.index}`);
      out('  用 cfm library open 在 Finder 查看，或 cfm ui 用面板浏览。');
      return;
    }
    if (sub === 'list' || !sub) {
      const idx = readLibrary();
      if (wantJson) return jsonOut(idx);
      printLibrary(idx); return;
    }
    if (sub === 'path') { out(libraryRoot()); return; }
    if (sub === 'set') {
      const dir = flags._[1];
      if (!dir) throw new Error('用法: cfm library set <dir>');
      out('本地库: ' + setLibraryRoot(dir)); return;
    }
    if (sub === 'open') {
      const dir = libraryRoot();
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
      out('已打开: ' + dir); return;
    }
    throw new Error('library 子命令: export | list | path | set | open');
  }

  if (cmd === 'folders') {
    const r = folderReport();
    if (wantJson) return jsonOut(r);
    head('项目文件夹');
    if (!r.projects.length) out('  没有登记项目（先在 Codex 里添加项目）');
    for (const p of r.projects) out(`  - ${p.name || p.id}: ${p.path} ${p.exists ? '' : '[不存在]'}`);
    if (r.missing.length) head(`缺失 ${r.missing.length} 个路径`);
    if (r.duplicates.length) { head('重复路径'); for (const d of r.duplicates) out(`  - ${d.path} x${d.n}`); }
    return;
  }

  if (cmd === 'skills') {
    const s = listSkills();
    if (wantJson) return jsonOut(s);
    head(`官方 Skills（${s.skills.length}）`);
    for (const k of s.skills.slice(0, 50)) out(`  - ${k.name}`);
    head(`Plugins（${s.plugins.length}）`);
    for (const p of s.plugins) out(`  - ${p.name}`);
    return;
  }

  if (cmd === 'providers') {
    const sub = flags._[0];
    if (sub === 'list' || !sub) {
      if (wantJson) return jsonOut(listProviders());
      printProviders(); return;
    }
    if (sub === 'presets') {
      for (const [id, p] of Object.entries(PRESETS)) out(`  ${id.padEnd(20)} ${p.name}  ${p.baseUrl || '(需自定义)'}`);
      return;
    }
    if (sub === 'add') {
      const presetId = flags._[1] || flags.preset;
      if (!presetId || !PRESETS[presetId]) throw new Error('用法: cfm providers add <preset> [--id] [--base-url] [--models] [--key-stdin]');
      const preset = PRESETS[presetId];
      const models = parseModels(flags.models || preset.models.map((m) => m.id).join(','));
      const key = await resolveKey(flags, preset);
      const p = addProvider({ presetId, id: flags.id, baseUrl: flags['base-url'], models, key });
      out(`已注册 ${p.id}: ${p.models.map((m) => m.id).join(', ')}`);
      out(`key 已保存到 ${secretPath(p.id)}（600，不会显示）`);
      return;
    }
    if (sub === 'use') {
      const id = flags._[1];
      if (!id) throw new Error('用法: cfm providers use <id> [--model] [--effort]');
      const r = useProvider(id, { model: flags.model, effort: flags.effort });
      out(`已切换: ${r.provider.name} / ${r.model} / effort=${r.effort}`);
      out(`配置: ${CONFIG_PATH}`);
      out(`目录: ${r.catalog.path}（${r.catalog.count} 个模型）`);
      return;
    }
    if (sub === 'current' || sub === 'status') {
      const c = configSummary();
      if (wantJson) return jsonOut({ ...c, config: CONFIG_PATH });
      out(`model=${c.model || '?'} provider=${c.provider || '?'}`);
      out(`config=${CONFIG_PATH}`);
      return;
    }
    if (sub === 'test') {
      const id = flags._[1];
      if (!id) {
        const list = listProviders();
        if (!list.length) {
          if (wantJson) return jsonOut([]);
          out('还没有注册供应商。');
          return;
        }
        const results = [];
        for (const p of list) {
          try {
            const r = await testProvider(p.id);
            results.push({ id: p.id, ...r });
            if (!wantJson) out(`${p.id}: HTTP ${r.models?.status ?? r.status} · models=${r.modelCount ?? '?'} · responses=${r.responses?.status ?? '?'}`);
          } catch (e) {
            results.push({ id: p.id, error: e.message });
            if (!wantJson) out(`${p.id}: ! ${e.message}`);
          }
        }
        if (wantJson) return jsonOut(results);
        return;
      }
      const r = await testProvider(id);
      if (wantJson) return jsonOut(r);
      out(`HTTP ${r.models?.status ?? r.status} · models=${r.modelCount ?? '?'} · responses=${r.responses?.status ?? '?'} · ${r.baseUrl}`);
      if (!r.responses?.ok) out('  ! /responses 未通过：Codex 0.163+ 需要 Responses API，不能直接用 chat/completions');
      return;
    }
    throw new Error('providers 子命令: list | presets | add | use | test');
  }

  if (cmd === 'catalog') {
    const sub = flags._[0];
    if (sub === 'build') {
      const id = flags._[1];
      const reg = loadRegistry();
      const p = reg.providers[id];
      if (!p) throw new Error('未注册: ' + id);
      const r = buildCatalog(id, p.models);
      out(`已生成 ${r.path}（${r.count} 个模型，来源 ${r.source}）`);
      return;
    }
    throw new Error('catalog 子命令: build <id>');
  }

  if (cmd === 'check') {
    const r = await checkForUpdates();
    if (wantJson) return jsonOut(r);
    if (r.error) out('! ' + r.error);
    else if (r.outdated) out('发现新版本 v' + r.latest + '（当前 v' + r.current + '）\n  ' + r.url);
    else out('当前已是最新版本 v' + r.current);
    return;
  }

  if (cmd === 'update') {
    out('正在安装 codex-for-free@latest …');
    const r = updateNow();
    if (wantJson) return jsonOut(r);
    out(r.ok ? '更新完成，请重启面板' : '更新失败');
    if (r.stderr) out(r.stderr);
    return;
  }

  if (cmd === 'completion') {
    const shell = flags._[0] || 'zsh';
    const commands = ['doctor','search','backup','restore','repair','uninstall','storage','library','folders','skills','providers','catalog','codex','ui','panel','knowledge','restore-official','check','update','completion'];
    if (shell === 'bash') {
      out(`complete -W "${commands.join(' ')}" cfm`);
    } else {
      out(`#compdef cfm`);
      out(`_cfm() { local -a cmds; cmds=(${commands.map((c) => "'" + c + "'").join(' ')}); _describe 'command' cmds; }`);
      out(`compdef _cfm cfm`);
    }
    return;
  }

  if (cmd === 'restore-official') {
    const r = restoreOfficialConfig();
    if (wantJson) return jsonOut(r);
    if (!r.ok) throw new Error(r.error);
    out('已还原官方 Codex 配置');
    out('备份: ' + r.backup);
    out(r.hasCfm ? '! 仍检测到 CFM 标记，请检查配置' : '官方配置已干净，重启 Codex 应用生效');
    return;
  }

  if (cmd === 'codex') {
    const bin = locateCodex();
    if (!bin) throw new Error('未找到 Codex CLI；设置 CODEX_BIN 或安装 Codex');
    const r = spawnSync(bin, rest, { stdio: 'inherit', env: { ...process.env, CODEX_HOME } });
    process.exit(r.status ?? 0);
  }

  if (cmd === 'ui') {
    const port = Number(flags.port || 4317);
    startServer({ port, open: !flags['no-open'] });
    return;
  }

  if (cmd === 'panel' || cmd === 'dashboard') {
    const port = Number(flags.port || 4317);
    await openPanel(port);
    out('已打开面板（对话端仍可通过应用图标进入）');
    return;
  }

  if (cmd === 'knowledge' || (cmd === 'library' && !flags._[0])) {
    const dir = libraryRoot();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
    out('已打开知识库: ' + dir);
    return;
  }

  throw new Error('未知命令: ' + cmd + '（cfm help 查看用法）');
}
