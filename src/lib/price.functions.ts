import { createServerFn } from "@tanstack/react-start";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
};

export const getQuote = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => ({
    symbol: String(data.symbol || "").trim().toUpperCase().slice(0, 20),
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) return { ok: false as const, error: "No symbol" };
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=1d&range=1d`,
        { headers: YF_HEADERS },
      );
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
      const json: any = await res.json();
      const r = json?.chart?.result?.[0];
      const price: number | undefined =
        r?.meta?.regularMarketPrice ?? r?.meta?.previousClose;
      const currency: string = r?.meta?.currency ?? "USD";
      if (typeof price !== "number")
        return { ok: false as const, error: "No price in response" };
      return {
        ok: true as const,
        symbol: data.symbol,
        price,
        currency,
        time: r?.meta?.regularMarketTime
          ? new Date(r.meta.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
      };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Fetch failed" };
    }
  });

export const searchSymbols = createServerFn({ method: "GET" })
  .inputValidator((data: { q: string }) => ({
    q: String(data.q || "").trim().slice(0, 40),
  }))
  .handler(async ({ data }) => {
    if (!data.q) return { ok: true as const, results: [] };
    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(data.q)}&quotesCount=8&newsCount=0`,
        { headers: YF_HEADERS },
      );
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}`, results: [] };
      const json: any = await res.json();
      const quotes: any[] = Array.isArray(json?.quotes) ? json.quotes : [];
      const results = quotes
        .filter((q) => q?.symbol)
        .slice(0, 8)
        .map((q) => ({
          symbol: String(q.symbol),
          name: String(q.shortname ?? q.longname ?? ""),
          exch: String(q.exchDisp ?? q.exchange ?? ""),
          type: String(q.quoteType ?? q.typeDisp ?? ""),
        }));
      return { ok: true as const, results };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Fetch failed", results: [] };
    }
  });

export const getUsdThb = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/THB=X?interval=1d&range=1d`,
      { headers: YF_HEADERS },
    );
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
    const json: any = await res.json();
    const r = json?.chart?.result?.[0];
    const rate: number | undefined =
      r?.meta?.regularMarketPrice ?? r?.meta?.previousClose;
    if (typeof rate !== "number")
      return { ok: false as const, error: "No rate" };
    return {
      ok: true as const,
      rate,
      time: r?.meta?.regularMarketTime
        ? new Date(r.meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "Fetch failed" };
  }
});

// ---------- Technical analysis ----------
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

function pivots(
  highs: number[],
  lows: number[],
  current: number,
  win = 5,
): { sup: number[]; res: number[] } {
  const sups: number[] = [];
  const ress: number[] = [];
  for (let i = win; i < highs.length - win; i++) {
    let isHigh = true,
      isLow = true;
    for (let j = i - win; j <= i + win; j++) {
      if (j === i) continue;
      if (highs[j] >= highs[i]) isHigh = false;
      if (lows[j] <= lows[i]) isLow = false;
    }
    if (isHigh) ress.push(highs[i]);
    if (isLow) sups.push(lows[i]);
  }
  // Dedupe close-by levels (within 1%)
  const dedupe = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (!out.length || Math.abs(v - out[out.length - 1]) / v > 0.01) out.push(v);
    }
    return out;
  };
  const supU = dedupe(sups).filter((v) => v < current);
  const resU = dedupe(ress).filter((v) => v > current);
  // Pick the 3 nearest to current price
  supU.sort((a, b) => current - a - (current - b)); // ascending distance
  resU.sort((a, b) => a - current - (b - current));
  return { sup: supU.slice(0, 3).sort((a, b) => b - a), res: resU.slice(0, 3).sort((a, b) => a - b) };
}

export const getTechnicals = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => ({
    symbol: String(data.symbol || "").trim().toUpperCase().slice(0, 20),
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) return { ok: false as const, error: "No symbol" };
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          data.symbol,
        )}?interval=1d&range=6mo`,
        { headers: YF_HEADERS },
      );
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
      const json: any = await res.json();
      const r = json?.chart?.result?.[0];
      const q = r?.indicators?.quote?.[0];
      const closes: number[] = (q?.close ?? []).filter((v: any) => typeof v === "number");
      const highs: number[] = (q?.high ?? []).filter((v: any) => typeof v === "number");
      const lows: number[] = (q?.low ?? []).filter((v: any) => typeof v === "number");
      if (closes.length < 30)
        return { ok: false as const, error: "Not enough data" };
      const price = closes[closes.length - 1];
      const ema20a = ema(closes, 20);
      const ema50a = ema(closes, 50);
      const ema200a = closes.length >= 200 ? ema(closes, 200) : null;
      const e20 = ema20a[ema20a.length - 1];
      const e50 = ema50a[ema50a.length - 1];
      const e200 = ema200a ? ema200a[ema200a.length - 1] : null;
      const rsiVal = rsi(closes, 14);
      const { sup, res: resi } = pivots(highs, lows, price, 5);
      // Trend signal
      let trend: "bullish" | "bearish" | "neutral" = "neutral";
      if (price > e20 && e20 > e50) trend = "bullish";
      else if (price < e20 && e20 < e50) trend = "bearish";

      return {
        ok: true as const,
        symbol: data.symbol,
        price,
        rsi: rsiVal,
        ema20: e20,
        ema50: e50,
        ema200: e200,
        supports: sup,
        resistances: resi,
        trend,
      };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Fetch failed" };
    }
  });
