import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fetchGithubCommits7d, resetGithubCacheForTests } from '../factors.ts';

const realFetch = globalThis.fetch;

function mockFetch(impl: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => impl()) as typeof fetch;
}

beforeEach(() => resetGithubCacheForTests());
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('fetchGithubCommits7d', () => {
  it('throws instead of silently returning 0 when GitHub rate-limits', async () => {
    mockFetch(() => new Response('{}', { status: 403 }));
    await assert.rejects(fetchGithubCommits7d(), /GitHub commit factor unavailable/);
  });

  it('throws on network errors without a cached value', async () => {
    mockFetch(() => {
      throw new Error('boom');
    });
    await assert.rejects(fetchGithubCommits7d(), /unavailable: boom/);
  });

  it('caches successes and serves them while GitHub is failing', async () => {
    let calls = 0;
    mockFetch(() => {
      calls++;
      return new Response(JSON.stringify([{}, {}, {}]), { status: 200 });
    });
    assert.equal(await fetchGithubCommits7d(), 3);
    mockFetch(() => new Response('{}', { status: 500 }));
    assert.equal(await fetchGithubCommits7d(), 3);
    assert.equal(calls, 1);
  });
});
