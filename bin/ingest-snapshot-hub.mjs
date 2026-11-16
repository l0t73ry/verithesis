#!/usr/bin/env node
/**
 * VPS cron: pull market snapshot via enclave-worker, POST to Ghostore Hub.
 * Requires: GHOSTORE_API_URL, VERITHESIS_INGEST_KEY (same as ghostore server)
 */
import { pullMarketSnapshot } from '../enclave-worker/src/snapshot-hub.ts';

const base = (process.env.GHOSTORE_API_URL || 'http://127.0.0.1:5610').replace(/\/$/, '');
const key = process.env.VERITHESIS_INGEST_KEY || '';

async function main() {
  if (!key) {
    console.error('VERITHESIS_INGEST_KEY required');
    process.exit(1);
  }
  const payload = await pullMarketSnapshot();
  const res = await fetch(`${base}/api/verithesis/snapshots/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Verithesis-Ingest-Key': key,
    },
    body: JSON.stringify({ payload, status: 'ok' }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error('ingest failed', res.status, body);
    process.exit(1);
  }
  console.log(body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});