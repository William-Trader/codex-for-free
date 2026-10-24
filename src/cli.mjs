import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CODEX_HOME, OFFICIAL_CODEX_HOME, OFFICIAL_CONFIG_PATH, CFM_HOME, CONFIG_PATH, CFM_CONFIG_PATH, HOME, locateCodex,
  IS_WINDOWS, CFM_BIN_DIR, LOCAL_APP_DATA
} from './paths.mjs';
import { officialHasCfm, restoreOfficialConfig } from './isolate.mjs';
import { fmtBytes, platform, redact, openPath, lockFileAcl, aclIsPrivate, which } from './util.mjs';
import { storageReport, vacuumAll, archiveOldSessions, folderReport } from './storage.mjs';
import {
  exportLibrary, readLibrary, libraryRoot, setLibraryRoot, libraryStats
} from './library.mjs';
import { listSkills } from './skills.mjs';
import {
  PRESETS, addProvider, useProvider, listProviders, testProvider,
  loadRegistry, hasSecret, secretPath, parseModels, readSecret, syncProviderModels
} from './providers.mjs';
import { buildCatalog } from './catalog.mjs';
import { checkForUpdates, updateNow } from './update.mjs';
import { startServer } from './server.mjs';
import { searchLibrary, createBackup, restoreBackup } from './maintenance.mjs';
import { checkCodexConfig, lintToml } from './toml-check.mjs';

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
  out(`  ${platformLabel()} ${plat.release} / ${plat.arch} / node ${plat.node}`);
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
    fs.statSync(CONFIG_PATH);
    const acl = aclIsPrivate(CONFIG_PATH);
    if (acl === null && (fs.statSync(CONFIG_PATH).mode & 0o777) !== 0o600) warnings.push('config.toml 权限不是 600');
    if (acl === false) warnings.push('config.toml ACL 未收窄（其他用户可读）');
  } catch { warnings.push('config.toml 不存在'); }
  for (const p of provs) {
    if (!p.hasKey) continue;
    try {
      fs.statSync(secretPath(p.id));
      const acl = aclIsPrivate(secretPath(p.id));
      if (acl === null && (fs.statSync(secretPath(p.id)).mode & 0o777) !== 0o600) warnings.push(`secret ${p.id}.key 权限不是 600`);
      if (acl === false) warnings.push(`secret ${p.id}.key ACL 未收窄`);
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

// macOS installs a renamed copy; Windows keeps the official app untouched.
const APP_PATH = process.env.CFM_APP_PATH || (IS_WINDOWS
  ? path.join(LOCAL_APP_DATA, 'OpenAI', 'Codex')
  : '/Applications/Codex for Free.app');

function platformLabel() {
  return IS_WINDOWS ? 'Windows' : 'macOS';
}

// The Windows app carries no Info.plist; the desktop build writes its own
// version into the CLI environment block it provisions in config.toml.
function windowsAppVersion(app) {
  try {
    const cfg = fs.readFileSync(CONFIG_PATH, 'utf8');
    const m = cfg.match(/BROWSER_USE_CODEX_APP_VERSION\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {}
  return null;
}

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

function installCli(dirFlag) {
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cfm.mjs');
  if (!fs.existsSync(script)) throw new Error('找不到 bin/cfm.mjs');
  if (IS_WINDOWS) return installCliWindows(script, dirFlag);
  try { fs.chmodSync(script, 0o755); } catch {}
  const dirs = dirFlag ? [path.resolve(dirFlag)] : ['/usr/local/bin', path.join(HOME, '.local', 'bin')];
  const problems = [];
  let target = null;
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      fs.accessSync(dir, fs.constants.W_OK);
      target = dir;
      break;
    } catch (e) {
      problems.push(`${dir}: ${e.code || e.message}`);
    }
  }
  if (!target) throw new Error('没有可写目录，用 --dir 指定：' + problems.join('; '));
  const links = [];
  for (const name of ['cfm', 'cff']) {
    const link = path.join(target, name);
    let current = null;
    try { current = fs.readlinkSync(link); } catch {}
    if (current) {
      if (path.resolve(target, current) === script) { links.push(link + '（已存在）'); continue; }
      fs.unlinkSync(link);
    } else if (fs.existsSync(link)) {
      throw new Error(`${link} 已存在且不是符号链接，先手动处理`);
    }
    fs.symlinkSync(script, link);
    links.push(link);
  }
  const onPath = (process.env.PATH || '').split(path.delimiter).includes(target);
  let patchedRc = null;
  if (!onPath) {
    const rc = path.join(HOME, '.zshrc');
    const marker = '# cfm:path';
    let text = '';
    try { text = fs.readFileSync(rc, 'utf8'); } catch {}
    if (!text.includes(marker)) {
      fs.appendFileSync(rc, `\n${marker}\nexport PATH="${target}:$PATH"\n`);
      patchedRc = rc;
    }
  }
  return { target, script, links, onPath, patchedRc };
}

// Windows cannot symlink into PATH without privileges, and a .cmd shim needs no
// elevation. The shim pins the absolute path of bin/cfm.mjs, so moving the repo
// means re-running `cfm install-cli`.
function installCliWindows(script, dirFlag) {
  const target = dirFlag ? path.resolve(dirFlag) : CFM_BIN_DIR;
  fs.mkdirSync(target, { recursive: true });
  const node = process.execPath;
  const links = [];
  for (const name of ['cfm', 'cff']) {
    const shim = path.join(target, name + '.cmd');
    const body = `@echo off\r\n"${node}" "${script}" %*\r\n`;
    fs.writeFileSync(shim, body, 'utf8');
    links.push(shim);
  }
  const userPath = process.env.PATH || '';
  const onPath = userPath.split(path.delimiter).some((d) => path.resolve(d || '.') === path.resolve(target));
  let patchedPath = null;
  if (!onPath) {
    const machine = spawnSync('powershell', ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('Path','User')`], { encoding: 'utf8' });
    const current = (machine.stdout || '').trim();
    if (current.split(';').some((d) => path.resolve(d || '.') === path.resolve(target))) {
      // Already persisted; this shell just inherited an older PATH.
      patchedPath = 'already in user PATH';
    } else {
      const next = current ? current.replace(/;$/, '') + ';' + target : target;
      const set = spawnSync('powershell', ['-NoProfile', '-Command', `[Environment]::SetEnvironmentVariable('Path', '${next.replace(/'/g, "''")}', 'User')`], { encoding: 'utf8' });
      if (set.status === 0) patchedPath = 'user PATH';
    }
  }
  return { target, script, links, onPath, patchedRc: patchedPath };
}

function libraryStaleness() {
  const idx = readLibrary();
  const indexAt = idx.generatedAt ? Date.parse(idx.generatedAt) : 0;
  let sourceAt = 0;
  try { sourceAt = fs.statSync(path.join(CODEX_HOME, 'thread_history_1.sqlite')).mtimeMs; } catch {}
  return { indexAt, sourceAt, stale: sourceAt > indexAt + 60_000 };
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
    if (IS_WINDOWS) {
      appName = 'Codex (official)';
      appVersion = windowsAppVersion(app);
    } else {
      const n = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleDisplayName', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' });
      const v = spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' });
      appName = (n.stdout || '').trim() || null;
      appVersion = (v.stdout || '').trim() || null;
    }
  } else checks.push({ level: 'error', id: 'app', message: IS_WINDOWS ? 'Codex desktop app not found' : 'Codex for Free.app not found' });
  if (bin) {
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    codexVersion = (v.stdout || '').trim() || null;
  } else checks.push({ level: 'error', id: 'codex', message: 'Codex CLI not found' });
  let configMode = null;
  try {
    const acl = aclIsPrivate(CONFIG_PATH);
    if (acl === null) {
      configMode = '0' + (fs.statSync(CONFIG_PATH).mode & 0o777).toString(8);
      if ((fs.statSync(CONFIG_PATH).mode & 0o777) !== 0o600) checks.push({ level: 'warn', id: 'config-mode', message: 'config.toml mode is not 600' });
    } else {
      configMode = acl ? 'acl-private' : 'acl-shared';
      if (!acl) checks.push({ level: 'warn', id: 'config-acl', message: 'config.toml ACL is not limited to the current user' });
    }
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
  if (IS_WINDOWS) {
    // Nothing is renamed on Windows, so repair is just: re-apply the provider
    // contract through install.ps1 without touching the official app.
    const key = readSecret('deepseek') || keyFromConfig();
    if (!key) throw new Error('找不到 DeepSeek key；先运行 installer/install.ps1');
    const installer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'installer', 'install.ps1');
    if (!fs.existsSync(installer)) throw new Error('installer/install.ps1 不存在');
    // Pass the key through the environment: a command line is visible to any
    // process on the machine, an env var of a child is not.
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installer, '-Yes'],
      { stdio: 'inherit', env: { ...process.env, CFM_KEY: key, DEEPSEEK_API_KEY: key } });
    if (r.status !== 0) throw new Error('安装器修复失败，退出码 ' + r.status);
    return { ok: true, app: APP_PATH, source: 'official (unmodified)', installer };
  }
  const target = APP_PATH;
  const preferred = process.env.CHATGPT_APP || '/Applications/ChatGPT.app';
  // After the official app is removed, repair still works by rebuilding from the installed frontend.
  const official = [preferred, '/Applications/ChatGPT.app', target].find((p) => p && fs.existsSync(p));
  if (!official) throw new Error('找不到可用源应用；重新安装官方 ChatGPT.app 或设置 CHATGPT_APP');
  let key = '';
  try { key = readSecret('deepseek'); } catch {}
  if (!key) key = keyFromConfig();
  if (!key) throw new Error('找不到 DeepSeek key；先运行 installer/install.sh');
  const installer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'installer', 'install.sh');
  if (!fs.existsSync(installer)) throw new Error('installer/install.sh 不存在');
  const r = spawnSync('zsh', [installer], { env: { ...process.env, CFM_KEY: key, CHATGPT_APP: official }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('安装器修复失败，退出码 ' + r.status);
  return { ok: true, app: target, source: official, installer };
}

function runUninstall({ yes = false, keepConfig = false } = {}) {
  if (!yes) throw new Error('uninstall requires --yes');
  if (IS_WINDOWS) {
    // The official app is never moved here: uninstall only reverts the config.
    let restored = null;
    if (!keepConfig) {
      const dir = path.dirname(CONFIG_PATH);
      const backups = fs.readdirSync(dir).filter((n) => n.startsWith('config.toml.bak-cfm-')).sort();
      if (backups.length) {
        const latest = path.join(dir, backups[backups.length - 1]);
        if (fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, path.join(dir, 'config.toml.bak-uninstall-' + Date.now()));
        fs.copyFileSync(latest, CONFIG_PATH);
        lockFileAcl(CONFIG_PATH);
        restored = latest;
      }
    }
    return { ok: true, moved: null, restored, note: 'official Codex app left untouched' };
  }
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
      openPath(base + target);
      return;
    }
  } catch {}
  startServer({ port, open: true, openPath: target });
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  // `cfm codex ...` is a passthrough: every flag belongs to the Codex CLI.
  if (cmd === 'codex') {
    const bin = locateCodex();
    if (!bin) throw new Error('未找到 Codex CLI；设置 CODEX_BIN 或安装 Codex');
    const r = spawnSync(bin, rest, { stdio: 'inherit', env: { ...process.env, CODEX_HOME } });
    process.exit(r.status ?? 0);
  }
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
  cfm install-cli [--dir DIR]        把 cfm 链接到 PATH（/usr/local/bin 或 ~/.local/bin）
  cfm ui [--port 4317]               启动本地面板（对话前端请用应用图标）
  cfm panel                           只打开管理面板
  cfm knowledge                       打开本地知识库（对话/项目文件）
  cfm config check                   校验 config.toml（重复根键/重复表/解析）
  cfm completion [zsh|bash|powershell] 输出命令补全
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
    let synced = null;
    const stale = libraryStaleness();
    if (stale.stale && !flags['no-sync']) {
      try { synced = exportLibrary({ rootDir: libraryRoot(), codexHome: CODEX_HOME }); } catch (e) { synced = { error: e.message }; }
    }
    const r = searchLibrary(q, {
      limit: Number(flags.limit || 100),
      includeJson: !!flags.all,
      includeArchive: !!flags.all
    });
    if (wantJson) return jsonOut({ ...r, synced, stale: stale.stale });
    if (synced && !synced.error) out(`（知识库落后，已自动同步：${synced.conversations} 个对话）`);
    else if (synced?.error) out(`（自动同步失败：${synced.error}）`);
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
      if (wantJson) return jsonOut({ ...idx, staleness: libraryStaleness() });
      printLibrary(idx);
      const st = libraryStaleness();
      if (st.stale) out('\n  ! 知识库落后于应用会话，运行 cfm library export 更新（cfm search 会自动同步）');
      return;
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
      openPath(dir);
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
    if (sub === 'sync') {
      const id = flags._[1];
      const targets = id ? [id] : listProviders().map((p) => p.id);
      const results = [];
      for (const pid of targets) {
        try {
          const r = await syncProviderModels(pid);
          results.push({ id: pid, changed: r.changed, models: r.models.map((m) => ({ id: m.id, context: m.context, reasoning: m.reasoning, default: m.defaultEffort })) });
        } catch (e) {
          results.push({ id: pid, error: e.message });
        }
      }
      if (wantJson) return jsonOut(results);
      for (const r of results) {
        if (r.error) { out(`${r.id}: ! ${r.error}`); continue; }
        out(`${r.id}: ${r.models.length} 个模型（更新 ${r.changed}）`);
        for (const m of r.models) out(`  ${m.id} · ctx=${m.context} · effort=${(m.reasoning || []).join('|')} · 默认=${m.default || '?'}`);
      }
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
      let models = p.models;
      if (!flags['no-sync']) {
        try { models = (await syncProviderModels(id)).models; } catch {}
      }
      const r = buildCatalog(id, models);
      out(`已生成 ${r.path}（${r.count} 个模型，来源 ${r.source}）`);
      return;
    }
    throw new Error('catalog 子命令: build <id>');
  }

  if (cmd === 'config') {
    const sub = flags._[0] || 'check';
    if (sub !== 'check') throw new Error('config 子命令: check');
    let text = '';
    try { text = fs.readFileSync(CONFIG_PATH, 'utf8'); }
    catch { throw new Error('config.toml 不存在: ' + CONFIG_PATH); }
    const r = checkCodexConfig(text);
    const py = which('python') || which('python3');
    let parser = null;
    if (py) {
      const pr = spawnSync(py, ['-c', 'import tomllib,sys;tomllib.loads(open(sys.argv[1],encoding="utf-8").read());print("ok")', CONFIG_PATH], { encoding: 'utf8' });
      parser = { tool: 'python tomllib', ok: pr.status === 0, error: pr.status === 0 ? null : (pr.stderr || '').trim().slice(0, 300) };
    }
    const ok = r.ok && (!parser || parser.ok);
    if (wantJson) return jsonOut({ path: CONFIG_PATH, ok, lint: r, parser });
    out('config: ' + CONFIG_PATH);
    if (!r.errors.length) out('  ✓ 无重复根键 / 无重复表');
    for (const e of r.errors) out(`  ! 第 ${e.line} 行: ${e.message}（首次出现在第 ${e.first} 行）`);
    if (r.missing.length) out('  ! 缺少根键: ' + r.missing.join(', '));
    if (parser) out(parser.ok ? '  ✓ ' + parser.tool + ' 解析通过' : '  ! ' + parser.tool + ': ' + parser.error);
    else out('  · 没有 python，跳过完整解析（用 lint 检查）');
    if (!ok) process.exitCode = 1;
    return;
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

  if (cmd === 'install-cli') {
    const r = installCli(typeof flags.dir === 'string' ? flags.dir : null);
    if (wantJson) return jsonOut(r);
    head('CLI 已安装');
    for (const link of r.links) out('  ' + link);
    out('  目标 ' + r.script);
    if (r.onPath) out('  现在可以直接运行 cfm doctor');
    else if (r.patchedRc === 'already in user PATH') out(`  ${r.target} 已在用户 PATH 中，重开终端即可`);
    else if (r.patchedRc && IS_WINDOWS) out(`  已把 ${r.target} 写入用户 PATH，重开终端后生效`);
    else if (r.patchedRc) out(`  已在 ${r.patchedRc} 写入 PATH，新开终端或用 source ${r.patchedRc} 生效`);
    else if (IS_WINDOWS) out(`  ! ${r.target} 不在 PATH，手动加入用户 PATH 后重开终端`);
    else out(`  ! ${r.target} 不在 PATH，加一行到 ~/.zshrc：export PATH="${r.target}:$PATH"`);
    return;
  }

  if (cmd === 'completion') {
    const shell = flags._[0] || (IS_WINDOWS ? 'powershell' : 'zsh');
    const commands = ['doctor','search','backup','restore','repair','uninstall','storage','library','folders','skills','providers','catalog','codex','install-cli','ui','panel','knowledge','restore-official','check','update','completion'];
    if (shell === 'powershell') {
      out(`Register-ArgumentCompleter -Native -CommandName cfm,cff -ScriptBlock {`);
      out(`  param($wordToComplete, $commandAst, $cursorPosition)`);
      out(`  '${commands.join(',')}' -split ',' | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {`);
      out(`    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)`);
      out(`  }`);
      out(`}`);
    } else if (shell === 'bash') {
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
    openPath(dir);
    out('已打开知识库: ' + dir);
    return;
  }

  throw new Error('未知命令: ' + cmd + '（cfm help 查看用法）');
}
