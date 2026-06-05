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
  current_price: number;
  rsi_14: number;
  ema_20: number;
  ema_50: number;
  support_level: number;
  resistance_level: number;
  notes: string;
  source: string;
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
                <p className="text-2xl font-bold">${fmt(data.current_price)}</p>
                <p className="text-[10px] text-muted-foreground">{data.source}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="RSI (14)" value={fmt(data.rsi_14)} />
              <Stat label="EMA 20" value={`$${fmt(data.ema_20)}`} />
              <Stat label="EMA 50" value={`$${fmt(data.ema_50)}`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <LevelCard title="Resistance (แนวต้าน)" value={data.resistance_level} color="text-red-400" />
              <LevelCard title="Support (แนวรับ)" value={data.support_level} color="text-emerald-400" />
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{data.notes}</p>
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

function LevelCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <p className={`text-sm font-mono font-semibold ${color}`}>${fmt(value)}</p>
    </div>
  );
}

