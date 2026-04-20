import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTokenAlert } from '../src/parser.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

// tokenAddress is excluded: real messages carry it only in entity URLs (not
// inline text), so text-only fixture files will always have tokenAddress: null.
const REQUIRED_FIELDS = [
  'tokenName', 'ageMinutes',
  'marketCap', 'athMarketCap', 'liquidity', 'volume1h',
  'fakeVolUSD', 'holderCount',
  'bundleCount', 'bundlePctInitial', 'bundlePctCurrent',
  'first20HoldingPct',
];

// ── Dynamic fixture sweep ─────────────────────────────────────────────────────

const fixtures = readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith('.txt'))
  .sort();

describe('required fields — all fixtures', () => {
  for (const file of fixtures) {
    const text = readFileSync(join(FIXTURES_DIR, file), 'utf8');
    describe(file, () => {
      const r = parseTokenAlert(text);
      it('parses to a non-null object', () => assert.ok(r !== null && typeof r === 'object'));
      it('securityFlag is boolean', () => assert.equal(typeof r?.securityFlag, 'boolean'));
      for (const field of REQUIRED_FIELDS) {
        it(`${field} is not null`, () => assert.notEqual(r?.[field], null, `${field} was null`));
      }
    });
  }
});

// ── Exact values — sample-message.txt ────────────────────────────────────────

describe('exact values — sample-message.txt', () => {
  const r = parseTokenAlert(readFileSync(join(FIXTURES_DIR, 'sample-message.txt'), 'utf8'));

  it('tokenName', () => assert.equal(r.tokenName, 'MOOMOO THE BULL'));
  it('ageMinutes', () => assert.equal(r.ageMinutes, 9));
  it('marketCap', () => assert.equal(r.marketCap, 49758));
  it('athMarketCap', () => assert.equal(r.athMarketCap, 51400));
  it('liquidity', () => assert.equal(r.liquidity, 17400));
  it('volume1h', () => assert.equal(r.volume1h, 23400));
  it('fakeVolUSD', () => assert.equal(r.fakeVolUSD, 23));
  it('fakeVolPct', () => assert.equal(r.fakeVolPct, 0.1));
  it('holderCount', () => assert.equal(r.holderCount, 357));
  it('bundleCount', () => assert.equal(r.bundleCount, 13));
  it('bundlePctInitial', () => assert.equal(r.bundlePctInitial, 82));
  it('bundlePctCurrent', () => assert.equal(r.bundlePctCurrent, 5.8));
  it('first20HoldingPct', () => assert.equal(r.first20HoldingPct, 62));
  it('securityFlag', () => assert.equal(r.securityFlag, false));
  it('devHoldingPct null when absent', () => assert.equal(r.devHoldingPct, null));
  it('devSoldPct null when absent', () => assert.equal(r.devSoldPct, null));
  it('airdropPct null when absent', () => assert.equal(r.airdropPct, null));
  it('burntPct null when absent', () => assert.equal(r.burntPct, null));
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns null for empty string', () => assert.equal(parseTokenAlert(''), null));
  it('returns null for null', () => assert.equal(parseTokenAlert(null), null));
  it('returns null for non-trending message', () => assert.equal(
    parseTokenAlert('Stay up to date on Soul! 🌟\n\nhttps://www.instagram.com/soulterminalai 📸'),
    null,
  ));
  it('securityFlag true when 🚨 present', () => {
    assert.equal(parseTokenAlert('🔥 ‎TOKEN New Trending\n🚨 Security').securityFlag, true);
  });
});
