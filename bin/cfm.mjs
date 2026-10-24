#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { main } from '../src/cli.mjs';

// Windows consoles default to code page 936 (GBK) while Node writes UTF-8, so
// Chinese output turns into mojibake. Switch to 65001 for this run only and put
// the user's original code page back on exit.
let originalCp = null;
if (process.platform === 'win32' && process.stdout.isTTY) {
  try {
    const before = execSync('chcp', { encoding: 'utf8' });
    const m = before.match(/(\d+)\s*$/m) || before.match(/(\d+)/);
    if (m && m[1] !== '65001') {
      execSync('chcp 65001', { stdio: 'ignore' });
      originalCp = m[1];
    }
  } catch {}
}
function restoreCodePage() {
  if (!originalCp) return;
  try { execSync('chcp ' + originalCp, { stdio: 'ignore' }); } catch {}
  originalCp = null;
}
process.on('exit', restoreCodePage);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { restoreCodePage(); process.exit(130); });
}

main(process.argv.slice(2))
  .catch((e) => {
    console.error('cfm error:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(restoreCodePage);
