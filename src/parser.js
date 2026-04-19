function parseDollar(str) {
  if (!str) return null;
  const s = str.replace(/,/g, '').toUpperCase();
  const m = s.match(/^([0-9.]+)([KMB]?)$/);
  if (!m) return null;
  let val = parseFloat(m[1]);
  if (isNaN(val)) return null;
  if (m[2] === 'K') val *= 1_000;
  else if (m[2] === 'M') val *= 1_000_000;
  else if (m[2] === 'B') val *= 1_000_000_000;
  return val;
}

export function parseTokenAlert(text) {
  if (!text || typeof text !== 'string') return null;

  const get = (re, g = 1) => { const m = text.match(re); return m ? m[g] : null; };

  // tokenName — between fire emoji and Soul_Sniper_Bot URL
  const nameRaw = get(/🔥[\s\u200e\u200f\u200b]*(.+?)\s*\(https?:\/\/t\.me\/Soul_Sniper_Bot/);
  const tokenName = nameRaw ? nameRaw.trim() : null;

  // tokenAddress — GeckoTerminal URL is the most explicit source
  const tokenAddress =
    get(/geckoterminal\.com\/solana\/tokens\/([A-Za-z0-9]{32,44})/) ||
    get(/fakevol_([A-Za-z0-9]{32,44})/) ||
    get(/bundle_([A-Za-z0-9]{32,44})/);

  const ageMinutes = (() => { const v = get(/Age:\s*(\d+)m/); return v !== null ? parseInt(v, 10) : null; })();

  const securityFlag = text.includes('🚨');

  const marketCap = parseDollar(get(/MC:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const athMarketCap = parseDollar(get(/🔝\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const liquidity = parseDollar(get(/Liq:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const volume1h = parseDollar(get(/Vol:\s*1h:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));

  const fakeBase = /Fake\s+\(https?:\/\/[^)]+\):\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/;
  const fakeUSDM = text.match(fakeBase);
  const fakeVolUSD = fakeUSDM ? parseDollar(fakeUSDM[1]) : null;
  const fakePctM = text.match(/Fake\s+\(https?:\/\/[^)]+\):\s*\$[^\[]*\[([0-9.]+)%\]/);
  const fakeVolPct = fakePctM ? parseFloat(fakePctM[1]) : null;

  const holderCount = (() => { const v = get(/Hodls:\s*(\d+)/); return v !== null ? parseInt(v, 10) : null; })();

  const bndM = text.match(/Bundles\s+\(https?:\/\/[^)]+\):\s*(\d+)\s*•\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/);
  const bundleCount = bndM ? parseInt(bndM[1], 10) : null;
  const bundlePctInitial = bndM ? parseFloat(bndM[2]) : null;
  const bundlePctCurrent = bndM ? parseFloat(bndM[3]) : null;

  // "Dev: (URL) X SOL | Y% $TOKEN" format — capture Y
  const devHoldM = text.match(/Dev(?:\s+holding)?:\s*(\d+(?:\.\d+)?)%/i) ||
                   text.match(/SOL\s*\|\s*(\d+(?:\.\d+)?)%\s*\$/);
  const devHoldingPct = devHoldM ? parseFloat(devHoldM[1]) : null;

  const devSoldM = text.match(/\bSold:\s*(\d+(?:\.\d+)?)%/i);
  const devSoldPct = devSoldM ? parseFloat(devSoldM[1]) : null;

  const airdropM = text.match(/Airdrops?:\s*(\d+(?:\.\d+)?)%/i);
  const airdropPct = airdropM ? parseFloat(airdropM[1]) : null;

  const burntM = text.match(/Burn(?:t|ed)?:\s*(\d+(?:\.\d+)?)%/i);
  const burntPct = burntM ? parseFloat(burntM[1]) : null;

  const f20M = text.match(/First 20\s+\(https?:\/\/[^)]+\):\s*(\d+(?:\.\d+)?)%/);
  const first20HoldingPct = f20M ? parseFloat(f20M[1]) : null;

  return {
    tokenName,
    tokenAddress,
    ageMinutes,
    marketCap,
    athMarketCap,
    liquidity,
    volume1h,
    fakeVolUSD,
    fakeVolPct,
    holderCount,
    bundleCount,
    bundlePctInitial,
    bundlePctCurrent,
    devHoldingPct,
    devSoldPct,
    airdropPct,
    burntPct,
    first20HoldingPct,
    securityFlag,
  };
}
