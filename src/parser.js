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

function addrFromUrls(urls) {
  for (const url of urls) {
    const m = url.match(/geckoterminal\.com\/solana\/tokens\/([A-Za-z0-9]{32,44})/) ||
              url.match(/fakevol_([A-Za-z0-9]{32,44})/) ||
              url.match(/bundle_([A-Za-z0-9]{32,44})/) ||
              url.match(/first20_([A-Za-z0-9]{32,44})/);
    if (m) return m[1];
  }
  return null;
}

// entityUrls: URLs from Telegram MessageEntityTextUrl objects.
// Real messages carry URLs as hyperlink entities, not inline text.
export function parseTokenAlert(text, entityUrls = []) {
  if (!text || typeof text !== 'string') return null;

  const get = (re, g = 1) => { const m = text.match(re); return m ? m[g] : null; };

  const nameRaw = get(/🔥[\s\u200e\u200f\u200b]*(.+?)\s+New Trending/);
  const tokenName = nameRaw ? nameRaw.trim() : null;
  if (!tokenName) return null;

  const tokenAddress = addrFromUrls(entityUrls);

  const ageMinutes = (() => { const v = get(/Age:\s*(\d+)m/); return v !== null ? parseInt(v, 10) : null; })();

  const securityFlag = text.includes('🚨');

  const marketCap = parseDollar(get(/MC:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const athMarketCap = parseDollar(get(/🔝\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const liquidity = parseDollar(get(/Liq:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const volume1h = parseDollar(get(/Vol:\s*1h:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));

  const fakeUSDM = text.match(/Fake:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/);
  const fakeVolUSD = fakeUSDM ? parseDollar(fakeUSDM[1]) : null;
  const fakePctM = text.match(/Fake:\s*\$[^\[]*\[([0-9.]+)%\]/);
  const fakeVolPct = fakePctM ? parseFloat(fakePctM[1]) : null;

  const holderCount = (() => { const v = get(/Hodls:\s*(\d+)/); return v !== null ? parseInt(v, 10) : null; })();

  const bndM = text.match(/Bundles:\s*(\d+)\s*•\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/);
  const bundleCount = bndM ? parseInt(bndM[1], 10) : null;
  const bundlePctInitial = bndM ? parseFloat(bndM[2]) : null;
  const bundlePctCurrent = bndM ? parseFloat(bndM[3]) : null;

  const devHoldM = text.match(/SOL\s*\|\s*(\d+(?:\.\d+)?)%\s*\$/);
  const devHoldingPct = devHoldM ? parseFloat(devHoldM[1]) : null;

  const devSoldM = text.match(/\bSold:\s*(\d+(?:\.\d+)?)%/i);
  const devSoldPct = devSoldM ? parseFloat(devSoldM[1]) : null;

  const airdropM = text.match(/Airdrops?:\s*(\d+(?:\.\d+)?)%/i);
  const airdropPct = airdropM ? parseFloat(airdropM[1]) : null;

  const burntM = text.match(/Burn(?:t|ed)?:\s*(\d+(?:\.\d+)?)%/i);
  const burntPct = burntM ? parseFloat(burntM[1]) : null;

  const f20M = text.match(/First 20:\s*(\d+(?:\.\d+)?)%/);
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
