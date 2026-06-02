import { createServerFn } from "@tanstack/react-start";

export const getQuote = createServerFn({ method: "GET" })
  .inputValidator((data: { symbol: string }) => ({
    symbol: String(data.symbol || "").trim().toUpperCase().slice(0, 20),
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) return { ok: false as const, error: "No symbol" };
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=1d&range=1d`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "application/json",
          },
        },
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
