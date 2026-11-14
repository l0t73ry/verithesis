#!/usr/bin/env node
/** Verify archived run by output_hash or input_hash. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = process.argv[2];
const recheck = process.argv.includes('--recheck');
const base = process.env.VERITHESIS_URL ?? 'http://localhost:5830';

if (!ref) {
  console.error('Usage: node bin/verify-run.mjs <output_hash|input_hash> [--recheck]');
  process.exit(1);
}

const dataDir = join(root, 'web-app', '.data');
const runsDir = join(dataDir, 'runs');
const indexPath = join(dataDir, 'runs-index.json');
const legacyPath = join(dataDir, 'runs-archive.json');

function findLocal(ref) {
  const h = ref.toLowerCase();
  if (existsSync(join(runsDir, `${h}.json`))) {
    return JSON.parse(readFileSync(join(runsDir, `${h}.json`), 'utf8'));
  }
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    const out = index.find((e) => e.output_hash.startsWith(h) || h.startsWith(e.output_hash));
    if (out) {
      const p = join(runsDir, `${out.output_hash}.json`);
      if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
    }
    const inputs = index.filter((e) => e.input_hash.startsWith(h) || h.startsWith(e.input_hash));
    inputs.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
    if (inputs[0]) {
      const p = join(runsDir, `${inputs[0].output_hash}.json`);
      if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  if (existsSync(legacyPath)) {
    const all = JSON.parse(readFileSync(legacyPath, 'utf8'));
    const key = Object.keys(all).find((k) => k === h || k.startsWith(h) || h.startsWith(k));
    if (key) return all[key];
  }
  if (existsSync(runsDir)) {
    for (const name of readdirSync(runsDir)) {
      if (name.startsWith(h) || h.startsWith(name.replace('.json', ''))) {
        return JSON.parse(readFileSync(join(runsDir, name), 'utf8'));
      }
    }
  }
  return null;
}

async function main() {
  if (recheck) {
    const res = await fetch(`${base}/api/thesis/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run: ref }),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    process.exit(res.ok && data.output_match ? 0 : 1);
  }

  const local = findLocal(ref);
  if (local) {
    console.log('found (local file)');
    console.log('output_hash:', local.attestation?.output_hash);
    console.log('execution:', local.attestation?.execution_timestamp);
    process.exit(0);
  }

  const res = await fetch(`${base}/api/thesis/verify?run=${encodeURIComponent(ref)}`);
  if (!res.ok) {
    const res2 = await fetch(`${base}/api/thesis/verify?hash=${encodeURIComponent(ref)}`);
    const data = await res2.json();
    if (!res2.ok) {
      console.error(data);
      process.exit(1);
    }
    console.log('output_hash:', data.output_hash);
    console.log('saved_at:', data.saved_at);
    return;
  }
  const data = await res.json();
  console.log('output_hash:', data.output_hash);
  console.log('saved_at:', data.saved_at);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
