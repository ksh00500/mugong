import { build } from 'esbuild';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const report = resolve(process.argv[2] ?? '.local-preview/online-balance/latest.json');
if (!report.endsWith('.json')) throw Error('Report path must end in .json');
const baseline = process.argv[3];
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error('Baseline must be a Git commit hash');
const original = new Map();
if (baseline) for (const path of ['src/raid/engine.ts', 'src/pvp/engine.ts'])
  original.set(resolve(path), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }));
const root = resolve('.local-preview/online-balance-runs', randomUUID());
await mkdir(root, { recursive: true });
const entry = resolve(root, 'probe-online-balance.mjs');
await build({ entryPoints: ['scripts/probe-online-balance.ts'], outfile: entry,
  bundle: true, platform: 'node', format: 'esm',
  plugins: baseline ? [{ name: 'baseline-combat', setup(builder) {
    builder.onLoad({ filter: /(?:raid|pvp)[\\/]engine\.ts$/ }, args => original.has(args.path)
      ? { contents: original.get(args.path), loader: 'ts', resolveDir: resolve(args.path, '..') } : undefined);
  } }] : [],
});
const child = spawn(process.execPath, [entry, report], { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
