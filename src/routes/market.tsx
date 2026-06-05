import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [{ title: "Market Playground — Live Technical Snapshot" }],
  }),
  component: MarketPage,
});

type MarketData = {
  symbol: string;
  price: number;
  currency: string;
  rsi: number | null;
  ema20: number;
  ema50: number;
  ema200: number | null;
  supports: number[];
  resistances: number[];
  trend: "bullish" | "bearish" | "neutral";
  source: string;
  time: string;
};

const fmt = (v: number | null | undefined, d = 2) =>
  typeof v === "number" && isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 2 })
    : "—";

function MarketPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState("");
  const [data, setData] = useState<MarketData | null>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSymbol = async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    setError(null);
    setSymbol(s);
    try {
      const res = await fetch(`/api/public/v1/market/${encodeURIComponent(s)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json.data);
      setFallback(Boolean(json.fallback));
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Market Playground
            </h1>
            <p className="text-sm text-muted-foreground">
              2-step flow: pick a symbol, get a live technical snapshot.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/api-docs"><Button variant="outline" size="sm">API</Button></Link>
            <Link to="/"><Button variant="outline" size="sm">App</Button></Link>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${step >= 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>1. Symbol</span>
          <span className="text-muted-foreground">→</span>
          <span className={`rounded-full px-2 py-0.5 ${step >= 2 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>2. Snapshot</span>
        </div>

        {/* Step 1: input */}
        <Card className="p-5 space-y-3 border-border/60 bg-card/40">
          <p className="text-sm font-medium">Step 1 — Enter or search a stock symbol</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchSymbol(input);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. AAPL, PLTR, NVDA"
                className="pl-8 uppercase"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Loading…" : "Get Snapshot"}
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "PLTR"].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); fetchSymbol(s); }}
                className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs hover:bg-primary/10 hover:border-primary/40"
              >
                {s}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </Card>

        {/* Step 2: results */}
        {step === 2 && data && (
          <Card className="p-5 space-y-4 border-border/60 bg-card/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Step 2 — Technical snapshot</p>
                <h2 className="text-xl font-bold tracking-wide">{data.symbol}</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">${fmt(data.price)}</p>
                <p className="text-[10px] text-muted-foreground">{data.currency} · {new Date(data.time).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold inline-flex items-center gap-1 ${
                data.trend === "bullish" ? "bg-emerald-500/15 text-emerald-400" :
                data.trend === "bearish" ? "bg-red-500/15 text-red-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {data.trend === "bullish" ? <TrendingUp className="h-3 w-3" /> : data.trend === "bearish" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {data.trend}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                source: {data.source}{fallback ? " (fallback)" : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="RSI (14)" value={fmt(data.rsi)} />
              <Stat label="EMA 20" value={`$${fmt(data.ema20)}`} />
              <Stat label="EMA 50" value={`$${fmt(data.ema50)}`} />
              <Stat label="EMA 200" value={data.ema200 ? `$${fmt(data.ema200)}` : "—"} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Levels title="Resistance (แนวต้าน)" levels={data.resistances} color="text-red-400" />
              <Levels title="Support (แนวรับ)" levels={data.supports} color="text-emerald-400" />
            </div>

            <pre className="text-[10px] bg-muted p-3 rounded overflow-x-auto">
GET /api/public/v1/market/{symbol}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

function Levels({ title, levels, color }: { title: string; levels: number[]; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {levels.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className={`space-y-0.5 text-sm font-mono ${color}`}>
          {levels.map((l, i) => <li key={i}>${fmt(l)}</li>)}
        </ul>
      )}
    </div>
  );
}
