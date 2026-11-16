#!/usr/bin/env node
/**
 * VPS cron: pull market snapshot via enclave-worker, POST to Ghostore Hub, then persist official signal.
 * Requires: GHOSTORE_API_URL, VERITHESIS_INGEST_KEY (same as ghostore server)
 */
import {
  pullMarketSnapshot,
  runThesisAnalysisFromSnapshot,
  officialThesisInput,
  buildOfficialSignalPayload,
} from '../enclave-worker/src/index.ts';

const base = (process.env.GHOSTORE_API_URL || 'http://127.0.0.1:5610').replace(/\/$/, '');
const key = process.env.VERITHESIS_INGEST_KEY || '';

async function postJson(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Verithesis-Ingest-Key': key,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  if (!key) {
    console.error('VERITHESIS_INGEST_KEY required');
    process.exit(1);
  }
  const payload = await pullMarketSnapshot();
  const snapRes = await postJson('/api/verithesis/snapshots/ingest', { payload, status: 'ok' });
  const snap = snapRes.data;
  if (!snap?.id) {
    console.error('ingest missing snapshot id', snapRes);
    process.exit(1);
  }

  const hubSnap = {
    id: snap.id,
    fetched_at: snap.fetched_at,
    status: snap.status || 'ok',
    near_rpc: payload.near_rpc ?? null,
    prices_near: payload.prices_near || [],
    prices_ref: payload.prices_ref || [],
    tvl_near: payload.tvl_near || [],
    github_commits_7d: payload.github_commits_7d ?? 0,
    funding_rate_bps: payload.funding_rate_bps ?? null,
    tvl_net_flow_7d_musd: payload.tvl_net_flow_7d_musd ?? null,
  };

  const input = {
    ...officialThesisInput(),
    code_measurement: process.env.VERITHESIS_CODE_MEASUREMENT || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    data_snapshot_id: snap.id,
  };

  const result = await runThesisAnalysisFromSnapshot(input, hubSnap, { data_snapshot_id: snap.id });
  result.hub_snapshot = { id: hubSnap.id, fetched_at: hubSnap.fetched_at, status: hubSnap.status };
  const view = buildOfficialSignalPayload(result);

  const sigRes = await postJson('/api/verithesis/signals/ingest', {
    data_snapshot_id: snap.id,
    strategy_id: view.strategy_id,
    signal: view.signal,
    suggested_action: view.suggested_action,
    pearson_r: view.pearson_r,
    input_hash: view.input_hash,
    output_hash: view.output_hash,
    code_measurement: input.code_measurement ?? null,
    payload: view,
    computed_at: new Date().toISOString(),
  });
  console.log(JSON.stringify({ snapshot: snapRes.data, signal: sigRes.data }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});