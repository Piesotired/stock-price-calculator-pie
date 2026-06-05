import { createFileRoute } from "@tanstack/react-router";
import { json, corsPreflight, logRequest } from "@/lib/api-key.server";

const PATH = "/api/public/v1/market/:symbol";

// Hardcoded Magnificent 7 realistic mock dataset
const MAG7: Record<
  string,
  {
    current_price: number;
    rsi_14: number;
    ema_20: number;
    ema_50: number;
    support_level: number;
    resistance_level: number;
  }
> = {
  AAPL: {
    current_price: 232.45,
    rsi_14: 58.2,
    ema_20: 228.9,
    ema_50: 220.15,
    support_level: 224.0,
    resistance_level: 240.0,
  },
  MSFT: {
    current_price: 438.12,
    rsi_14: 61.5,
    ema_20: 432.8,
    ema_50: 421.5,
    support_level: 428.0,
    resistance_level: 445.0,
  },
  GOOGL: {
    current_price: 178.35,
    rsi_14: 52.8,
    ema_20: 175.6,
    ema_50: 170.2,
    support_level: 173.0,
    resistance_level: 185.0,
  },
  AMZN: {
    current_price: 215.8,
    rsi_14: 56.4,
    ema_20: 211.5,
    ema_50: 204.0,
    support_level: 208.0,
    resistance_level: 222.0,
  },
  NVDA: {
    current_price: 142.6,
    rsi_14: 48.9,
    ema_20: 139.8,
    ema_50: 132.5,
    support_level: 136.0,
    resistance_level: 148.0,
  },
  META: {
    current_price: 595.2,
    rsi_14: 63.1,
    ema_20: 588.0,
    ema_50: 572.0,
    support_level: 582.0,
    resistance_level: 610.0,
  },
  TSLA: {
    current_price: 248.9,
    rsi_14: 54.3,
    ema_20: 243.5,
    ema_50: 232.0,
    support_level: 238.0,
    resistance_level: 258.0,
  },
};

// Seeded pseudo-random generator for deterministic dynamic mocks
function seededRandom(symbol: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < symbol.length; i++) {
    h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
  }
  let a = h ^ Math.floor(Date.now() / (1000 * 60 * 5));
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Graceful fallback for any symbol outside the Magnificent 7
function dynamicMock(symbol: string) {
  const rand = seededRandom(symbol);
  const base = 20 + rand() * 480; // $20 – $500 baseline
  const current_price = +(base * (0.98 + rand() * 0.04)).toFixed(2);
  const rsi_14 = +(45 + rand() * 20).toFixed(2); // 45 – 65
  const ema_20 = +(current_price * (0.985 + rand() * 0.03)).toFixed(2);
  const ema_50 = +(current_price * (0.96 + rand() * 0.06)).toFixed(2);
  const support_level = +(current_price * (0.93 + rand() * 0.02)).toFixed(2);
  const resistance_level = +(current_price * (1.07 + rand() * 0.03)).toFixed(2);
  return {
    symbol,
    current_price,
    rsi_14,
    ema_20,
    ema_50,
    support_level,
    resistance_level,
    notes: "Simulated production-grade technical analysis data",
    source: "mock-dynamic",
  };
}

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

        const mag7 = MAG7[symbol];
        if (mag7) {
          await logRequest(request, 200, PATH);
          return json({
            data: {
              symbol,
              current_price: mag7.current_price,
              rsi_14: mag7.rsi_14,
              ema_20: mag7.ema_20,
              ema_50: mag7.ema_50,
              support_level: mag7.support_level,
              resistance_level: mag7.resistance_level,
              notes: "Simulated production-grade technical analysis data",
              source: "mock-mag7",
            },
          });
        }

        // Non-Mag7: always return a clean dynamic mock with HTTP 200
        const data = dynamicMock(symbol);
        await logRequest(request, 200, PATH);
        return json({ data });
      },
    },
  },
});

