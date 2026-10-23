#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).catch((e) => {
  console.error('cfm error:', e?.message || e);
  process.exit(1);
});
