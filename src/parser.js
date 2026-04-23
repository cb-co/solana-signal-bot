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

function parseAgeMinutes(text) {
  const segment = text.match(/Age:\s*(.+?)(?:\s*\[|$)/m);
  if (!segment) return null;
  const ageStr = segment[1].trim();
  let total = 0;
  const units = { y: 365 * 24 * 60, mo: 30 * 24 * 60, d: 24 * 60, h: 60, m: 1 };
  // Match all "NUNit" tokens, longest unit suffix first to avoid 'm' matching 'mo'
  const re = /(\d+)\s*(mo|y|d|h|m)\b/g;
  let match;
  while ((match = re.exec(ageStr)) !== null) {
    total += parseInt(match[1], 10) * (units[match[2]] ?? 0);
  }
  return total > 0 ? total : null;
}

export function parseScannerReply(text, address) {
  if (!text || typeof text !== 'string') return { address, raw: text };

  const get = (re, g = 1) => { const m = text.match(re); return m ? m[g] : null; };

  // Header: "💊🔁 ‎TOKEN • $TICKER" — 💊 = still on pump.fun bonding curve
  const isPumpFun = text.split('\n')[0].includes('💊');
  const nameRaw = get(/[‎‏​]\s*(.+?)\s*•\s*\$/);
  const tokenName = nameRaw ? nameRaw.trim() : null;

  const ageMinutes = parseAgeMinutes(text);
  const priceChange1h = (() => {
    const v = get(/Age:\s*\d+(?:m|h|d|mo)\s*\[([+-]?\d+(?:\.\d+)?)%\]/);
    return v !== null ? parseFloat(v) : null;
  })();

  const securityFlag = text.includes('🚨');

  const marketCap = parseDollar(get(/MC:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const athMarketCap = parseDollar(get(/🔝\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const liquidity = parseDollar(get(/v?Liq:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const volume1h = parseDollar(get(/Vol:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));

  // Fake volume: "Fake: $3.2K [0.7%]"
  const fakeVolUSD = parseDollar(get(/Fake:\s*\$([0-9,]+(?:\.\d+)?[KkMmBb]?)/));
  const fakeVolPct = (() => {
    const v = get(/Fake:\s*\$[^\[]*\[([0-9.]+)%\]/);
    return v !== null ? parseFloat(v) : null;
  })();

  // Commas in large counts e.g. "327,909"
  const holderCountRaw = get(/Hodls:\s*([\d,]+)/);
  const holderCount = holderCountRaw ? parseInt(holderCountRaw.replace(/,/g, ''), 10) : null;
  const topHolderPct = (() => { const v = get(/Top:\s*([0-9.]+)%/); return v !== null ? parseFloat(v) : null; })();

  // Fake holders: "Fake: 585 [63.2%]" — no $ sign, distinct from fake volume
  const fakeHolderM = text.match(/Fake:\s*(\d[\d,]*)\s*\[([0-9.]+)%\]/);
  const fakeHolderCount = fakeHolderM ? parseInt(fakeHolderM[1].replace(/,/g, ''), 10) : null;
  const fakeHolderPct = fakeHolderM ? parseFloat(fakeHolderM[2]) : null;

  // iLP: "🌊 iLP: 0% • 0% Burnt"
  const ilpM = text.match(/iLP:\s*([0-9.]+)%\s*•\s*([0-9.]+)%\s*Burnt/);
  const ilpPct = ilpM ? parseFloat(ilpM[1]) : null;
  const ilpBurntPct = ilpM ? parseFloat(ilpM[2]) : null;

  // Bundles: "Bundles: 2 • 42% → 16.7%" or just "Bundles: 0"
  const bundleCountRaw = get(/Bundles:\s*(\d+)/);
  const bundleCount = bundleCountRaw !== null ? parseInt(bundleCountRaw, 10) : null;
  const bndPctM = text.match(/Bundles:\s*\d+\s*•\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/);
  const bundlePctInitial = bndPctM ? parseFloat(bndPctM[1]) : null;
  const bundlePctCurrent = bndPctM ? parseFloat(bndPctM[2]) : null;

  const sniperCountRaw = get(/Snipers:\s*(\d+)/);
  const sniperCount = sniperCountRaw !== null ? parseInt(sniperCountRaw, 10) : null;

  const f20M = text.match(/First 20:\s*(\d+(?:\.\d+)?)%/);
  const first20HoldingPct = f20M ? parseFloat(f20M[1]) : null;

  // Dev: "Dev: 0 SOL • 0%" — uses • instead of |
  const devM = text.match(/Dev:\s*([0-9.]+)\s*SOL\s*[•|]\s*([0-9.]+)%/);
  const devSolAmount = devM ? parseFloat(devM[1]) : null;
  const devHoldingPct = devM ? parseFloat(devM[2]) : null;

  const devBundledM = text.match(/Bundled:\s*([0-9.]+)%/i);
  const devBundledPct = devBundledM ? parseFloat(devBundledM[1]) : null;

  const devSoldM = text.match(/\bSold:\s*([0-9.]+)%/i);
  const devSoldPct = devSoldM ? parseFloat(devSoldM[1]) : null;

  const airdropM = text.match(/Airdrops?:\s*([0-9.]+)%/i);
  const airdropPct = airdropM ? parseFloat(airdropM[1]) : null;

  const dexPaidM = text.match(/Paid([✅❌])/);
  const dexPaid = dexPaidM ? dexPaidM[1] === '✅' : null;

  const scanCountRaw = get(/Scans:\s*([\d,]+)/);
  const scanCount = scanCountRaw ? parseInt(scanCountRaw.replace(/,/g, ''), 10) : null;

  return {
    tokenName,
    tokenAddress: address,
    ageMinutes,
    priceChange1h,
    marketCap,
    athMarketCap,
    liquidity,
    volume1h,
    fakeVolUSD,
    fakeVolPct,
    holderCount,
    topHolderPct,
    fakeHolderCount,
    fakeHolderPct,
    ilpPct,
    ilpBurntPct,
    bundleCount,
    bundlePctInitial,
    bundlePctCurrent,
    sniperCount,
    first20HoldingPct,
    devSolAmount,
    devHoldingPct,
    devBundledPct,
    devSoldPct,
    airdropPct,
    isPumpFun,
    dexPaid,
    scanCount,
    securityFlag,
  };
}
