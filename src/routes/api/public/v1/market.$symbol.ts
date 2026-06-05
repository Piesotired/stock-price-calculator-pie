import { createFileRoute } from "@tanstack/react-router";
import { json, corsPreflight, logRequest } from "@/lib/api-key.server";
import { getQuote, getTechnicals } from "@/lib/price.functions";
import { mockMarket } from "@/lib/market-mock";

const PATH = "/api/public/v1/market/:symbol";

export const Route = createFileRoute("/api/public/v1/market/$symbol")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const symbol = String(params.symbol || "").trim().toUpperCase().slice(0, 20);
        if (!symbol || !/^[A-Z0-9.\-]+$/.test(symbol)) {
          await logRequest(request, 400, PATH);
          return json({ error: "Invalid symbol" }, 400);
        }
        try {
          const [quote, tech] = await Promise.all([
            getQuote({ data: { symbol } }),
            getTechnicals({ data: { symbol } }),
          ]);
          if (quote.ok && tech.ok) {
            await logRequest(request, 200, PATH);
            return json({
              data: {
                symbol,
                price: quote.price,
                currency: quote.currency,
                rsi: tech.rsi,
                ema20: tech.ema20,
                ema50: tech.ema50,
                ema200: tech.ema200,
                supports: tech.supports,
                resistances: tech.resistances,
                trend: tech.trend,
                source: "live",
                time: quote.time,
              },
            });
          }
        } catch (e) {
          console.error("market live fetch failed", e);
        }
        // Fallback: deterministic mock so the API never crashes
        const data = mockMarket(symbol);
        await logRequest(request, 200, PATH);
        return json({ data, fallback: true });
      },
    },
  },
});
