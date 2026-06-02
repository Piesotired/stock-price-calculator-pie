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
