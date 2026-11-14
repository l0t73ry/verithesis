import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { rateLimit, resetRateLimitForTests } from '../rate-limit.ts';

const req = (ip: string) => new Request('http://x.test/', { headers: { 'x-forwarded-for': ip } });

beforeEach(() => resetRateLimitForTests());

describe('rateLimit', () => {
  it('allows up to the limit then returns 429 with Retry-After', () => {
    const t = 1_000;
    assert.equal(rateLimit(req('1.1.1.1'), 's', 2, t), null);
    assert.equal(rateLimit(req('1.1.1.1'), 's', 2, t), null);
    const res = rateLimit(req('1.1.1.1'), 's', 2, t + 10);
    assert.equal(res?.status, 429);
    assert.ok(Number(res?.headers.get('retry-after')) >= 1);
  });

  it('isolates clients and scopes', () => {
    assert.equal(rateLimit(req('1.1.1.1'), 's', 1, 0), null);
    assert.equal(rateLimit(req('2.2.2.2'), 's', 1, 0), null);
    assert.equal(rateLimit(req('1.1.1.1'), 'other', 1, 0), null);
    assert.equal(rateLimit(req('1.1.1.1'), 's', 1, 1)?.status, 429);
  });

  it('resets after the window', () => {
    assert.equal(rateLimit(req('3.3.3.3'), 's', 1, 0), null);
    assert.equal(rateLimit(req('3.3.3.3'), 's', 1, 1)?.status, 429);
    assert.equal(rateLimit(req('3.3.3.3'), 's', 1, 61_000), null);
  });

  it('is disabled by a non-positive limit', () => {
    for (let i = 0; i < 5; i++) assert.equal(rateLimit(req('4.4.4.4'), 's', 0, 0), null);
  });
});
