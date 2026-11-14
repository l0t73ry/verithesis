import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFullHash, normalizeRunRef, refMatches } from '../run-ref.ts';

const H = 'a'.repeat(64);

describe('normalizeRunRef', () => {
  it('accepts 8–64 hex chars and lower-cases them', () => {
    assert.equal(normalizeRunRef(`  ${'AB12'.repeat(2)} `), 'ab12ab12');
    assert.equal(normalizeRunRef(H), H);
  });

  it('rejects path traversal and anything non-hex', () => {
    for (const bad of ['../../package', '..%2f..%2fpackage', 'a/b/c/d/e/f/g/h', 'abcdefgh', 'abc', `${H}0`, '', '.', 'ab12ab12.json', 'ab12ab1\\2']) {
      assert.equal(normalizeRunRef(bad), null, bad);
    }
    assert.equal(normalizeRunRef(undefined), null);
    assert.equal(normalizeRunRef(['ab12ab12']), null);
  });
});

describe('refMatches', () => {
  it('matches only when the stored hash starts with the ref (one direction)', () => {
    assert.equal(refMatches(H, 'a'.repeat(8)), true);
    assert.equal(refMatches('a'.repeat(8), `${'a'.repeat(8)}ffff`), false);
  });

  it('refuses prefixes shorter than 8 chars', () => {
    assert.equal(refMatches(H, 'a'), false);
    assert.equal(refMatches(H, 'aaaaaaa'), false);
  });
});

describe('isFullHash', () => {
  it('requires exactly 64 lowercase hex', () => {
    assert.equal(isFullHash(H), true);
    assert.equal(isFullHash('A'.repeat(64)), false);
    assert.equal(isFullHash('../' + 'a'.repeat(61)), false);
  });
});
