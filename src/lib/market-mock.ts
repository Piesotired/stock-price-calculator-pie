// Deterministic-ish mock market data generator for fallback when live fetch fails.

const MAG7_BASE: Record<string, number> = {
  AAPL: 232,
  MSFT: 438,
  GOOGL: 178,
  AMZN: 215,
  NVDA: 142,
  META: 595,
  TSLA: 248,
};

function seeded(symbol: string): () => number {
  // xfnv1a hash
  let h = 2166136261 >>> 0;
  for (let i = 0; i < symbol.length; i++) {
    h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
  }
  // mulberry32
  let a = h ^ Math.floor(Date.now() / (1000 * 60 * 5)); // shift every 5 min
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mockMarket(symbolRaw: string) {
  const symbol = symbolRaw.toUpperCase();
  const rand = seeded(symbol);
  const isMag7 = symbol in MAG7_BASE;
  const base = MAG7_BASE[symbol] ?? 20 + rand() * 380; // $20 - $400 for non-mag7
  // ± 2% wobble for "current" price
  const price = +(base * (0.98 + rand() * 0.04)).toFixed(2);
  const rsi = +(30 + rand() * 40).toFixed(2); // 30–70
  const ema20 = +(price * (0.985 + rand() * 0.03)).toFixed(2);
  const ema50 = +(price * (0.96 + rand() * 0.06)).toFixed(2);
  const ema200 = +(price * (0.85 + rand() * 0.2)).toFixed(2);
  const supports = [
    +(price * (0.97 - rand() * 0.01)).toFixed(2),
    +(price * (0.94 - rand() * 0.01)).toFixed(2),
    +(price * (0.9 - rand() * 0.02)).toFixed(2),
  ];
  const resistances = [
    +(price * (1.03 + rand() * 0.01)).toFixed(2),
    +(price * (1.06 + rand() * 0.01)).toFixed(2),
    +(price * (1.1 + rand() * 0.02)).toFixed(2),
  ];
  const trend: "bullish" | "bearish" | "neutral" =
    price > ema20 && ema20 > ema50 ? "bullish" : price < ema20 && ema20 < ema50 ? "bearish" : "neutral";
  return {
    symbol,
    price,
    currency: "USD",
    rsi,
    ema20,
    ema50,
    ema200,
    supports,
    resistances,
    trend,
    source: isMag7 ? "mock-mag7" : "mock-generic",
    time: new Date().toISOString(),
  };
}
