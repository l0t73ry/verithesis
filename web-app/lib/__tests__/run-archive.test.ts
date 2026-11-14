import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { ThesisResult } from '@verithesis/enclave-worker';

// DATA_DIR is resolved at import time, so point it at a temp dir first and import lazily.
// Nested so `<dataDir>/..` is also private to this test (a traversal escape cannot pollute /tmp).
const sandboxRoot = mkdtempSync(join(tmpdir(), 'vt-archive-test-'));
const dataDir = join(sandboxRoot, 'data');
mkdirSync(dataDir);
process.env.VERITHESIS_DATA_DIR = dataDir;
// A decoy a traversal attack would love to read: <dataDir>/runs/../secret.json
writeFileSync(join(dataDir, 'secret.json'), JSON.stringify({ leaked: true }));

let archive: typeof import('../run-archive.ts');
let analyze: typeof import('@verithesis/enclave-worker').analyzeMergedSeries;

const series = Array.from({ length: 8 }, (_, i) => ({
  date: `2025-04-0${i + 1}`,
  price_usd: 5 + i * 0.1 + (i % 2) * 0.05,
  defi_tvl_usd: 1e8 + i * 1e6,
}));
const factors = { github_commits_7d: 30, funding_rate_bps: 1, whale_net_flow_musd: 1 };

function makeRun(tf: '7d' | '30d' = '30d'): ThesisResult {
  return analyze(series, { timeframe: tf, target_token: 'NEAR' }, { factors });
}

before(async () => {
  archive = await import('../run-archive.ts');
  ({ analyzeMergedSeries: analyze } = await import('@verithesis/enclave-worker'));
});
after(() => rmSync(sandboxRoot, { recursive: true, force: true }));

describe('run archive', () => {
  it('round-trips a run by full hash, prefix and input hash', () => {
    const run = makeRun();
    archive.archiveRun(run);
    assert.equal(archive.findRunByHash(run.attestation.output_hash)?.attestation.output_hash, run.attestation.output_hash);
    assert.ok(archive.findRunByHash(run.attestation.output_hash.slice(0, 12)));
    assert.ok(archive.findRunByHash(run.attestation.input_hash));
    assert.ok(archive.findRunReceipt(run.attestation.output_hash));
  });

  it('cannot be used to read arbitrary .json files (path traversal)', () => {
    for (const evil of ['../secret', '../../secret', '..%2fsecret', '../runs/../secret', 'secret']) {
      assert.equal(archive.findRunByHash(evil), null, evil);
    }
    assert.equal(archive.findRunReceipt('../secret'), null);
  });

  it('refuses to archive a result with malformed / traversal hashes and writes nothing', () => {
    const run = makeRun('7d');
    const evil = { ...run, attestation: { ...run.attestation, output_hash: '../../escaped' } };
    assert.throws(() => archive.archiveRun(evil), /malformed attestation hashes/);
    assert.equal(existsSync(join(sandboxRoot, 'escaped.json')), false);
    assert.equal(existsSync(join(dataDir, 'escaped.json')), false);
  });

  it('refuses over-long or too-short refs', () => {
    const run = makeRun();
    archive.archiveRun(run);
    assert.equal(archive.findRunByHash(run.attestation.output_hash.slice(0, 6)), null);
    assert.equal(archive.findRunByHash(`${run.attestation.output_hash}ff`), null);
  });

  it('survives a corrupt index / run file instead of throwing', () => {
    const run = makeRun();
    archive.archiveRun(run);
    writeFileSync(join(dataDir, 'runs-index.json'), '{not json');
    writeFileSync(join(dataDir, 'runs', `${run.attestation.output_hash}.json`), '{truncated');
    assert.equal(archive.findRunByHash(run.attestation.output_hash), null);
    // and archiving again recovers
    archive.archiveRun(run);
    assert.ok(archive.findRunByHash(run.attestation.output_hash));
  });

  it('writes atomically (no temp files left behind) and keeps valid JSON on disk', () => {
    const run = makeRun();
    archive.archiveRun(run);
    for (const dir of [dataDir, join(dataDir, 'runs'), join(dataDir, 'receipts')]) {
      assert.deepEqual(readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
    }
    JSON.parse(readFileSync(join(dataDir, 'runs-index.json'), 'utf8'));
  });
});
