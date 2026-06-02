import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart,
  DollarSign,
  Rocket,
  Search,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react";
import { getQuote, searchSymbols, getUsdThb, getTechnicals } from "@/lib/price.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cost Basis Calculator — Live Price & Profit Simulator" },
      {
        name: "description",
        content:
          "Sync live stock prices, recalculate average cost after buying more, and simulate sell profit at any target price.",
      },
    ],
  }),
  component: Index,
});

type Num = number | "";
const n = (v: Num) => (typeof v === "number" && !isNaN(v) ? v : 0);
const fmt = (v: number, d = 2) =>
  isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 2 })
    : "—";
const fmtShares = (v: number) =>
  isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—";

type Ccy = "USD" | "THB";

function NumField({
  label,
  thai,
  value,
  onChange,
  prefix,
  hint,
}: {
  label: string;
  thai?: string;
  value: Num;
  onChange: (v: Num) => void;
  prefix?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-baseline gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {thai && (
          <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70">
            ({thai})
          </span>
        )}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? "" : parseFloat(v));
          }}
          className={`${prefix ? "pl-7" : ""} h-9 bg-background/60 text-sm`}
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  thai,
  value,
  tone,
  emphasize,
}: {
  label: string;
  thai?: string;
  value: string;
  tone?: "pos" | "neg";
  emphasize?: boolean;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
        ? "text-red-400"
        : "text-foreground";
  return (
    <div
      className={`flex h-[46px] flex-col justify-center rounded-md border border-border/50 bg-card/50 px-2.5 ${
        emphasize ? "ring-1 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-baseline gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {thai && (
          <span className="normal-case tracking-normal opacity-70">({thai})</span>
        )}
      </div>
      <div className={`text-sm font-semibold tabular-nums leading-tight ${color}`}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  step,
  title,
  thai,
  icon,
}: {
  step?: string;
  title: string;
  thai?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {step && (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
          {step}
        </span>
      )}
      {icon && <span className="text-primary">{icon}</span>}
      <div className="leading-tight">
        <div className="text-sm font-semibold">{title}</div>
        {thai && <div className="text-[10px] text-muted-foreground">{thai}</div>}
      </div>
    </div>
  );
}

function Index() {
  const fetchQuote = useServerFn(getQuote);
  const fetchSearch = useServerFn(searchSymbols);
  const fetchFx = useServerFn(getUsdThb);

  const [ticker, setTicker] = useState("META");
  const [avgCost, setAvgCost] = useState<Num>(597);
  const [totalCost, setTotalCost] = useState<Num>(69.93);
  const [currentPrice, setCurrentPrice] = useState<Num>(610);
  const [buyUsd, setBuyUsd] = useState<Num>(15);
  const [sellPrice, setSellPrice] = useState<Num>(620);
  const [sellShares, setSellShares] = useState<Num>(0);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [buyKey, setBuyKey] = useState(0);
  const [sellKey, setSellKey] = useState(0);

  // Ticker autocomplete
  const [suggestions, setSuggestions] = useState<
    { symbol: string; name: string; exch: string; type: string }[]
  >([]);
  const [showSug, setShowSug] = useState(false);
  const [searching, setSearching] = useState(false);
  const sugBoxRef = useRef<HTMLDivElement | null>(null);

  // Currency toggle
  const [ccy, setCcy] = useState<Ccy>("USD");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!had) root.classList.remove("dark");
    };
  }, []);

  // Load FX rate once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchFx({});
        if (r.ok) setFxRate(r.rate);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced symbol search
  useEffect(() => {
    const q = ticker.trim();
    if (!q || !showSug) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetchSearch({ data: { q } });
        if (r.ok) setSuggestions(r.results);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, showSug]);

  // Click outside to close suggestion
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (sugBoxRef.current && !sugBoxRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function handleSync(sym?: string) {
    const symbol = (sym ?? ticker).trim();
    if (!symbol) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetchQuote({ data: { symbol } });
      if (res.ok) {
        setCurrentPrice(Number(res.price.toFixed(4)));
        setSyncMsg({ ok: true, text: `${res.symbol} ${res.currency} ${fmt(res.price)}` });
      } else {
        setSyncMsg({ ok: false, text: `Sync failed: ${res.error}` });
      }
    } catch (e: any) {
      setSyncMsg({ ok: false, text: `Sync failed: ${e?.message ?? "error"}` });
    } finally {
      setSyncing(false);
    }
  }

  async function refreshFx() {
    setFxLoading(true);
    try {
      const r = await fetchFx({});
      if (r.ok) setFxRate(r.rate);
    } finally {
      setFxLoading(false);
    }
  }

  // Money formatter respecting current currency
  const money = (usd: number) => {
    if (ccy === "USD" || !fxRate) return `$${fmt(usd)}`;
    return `฿${fmt(usd * fxRate)}`;
  };
  const moneySigned = (usd: number) => {
    const s = usd >= 0 ? "+" : "-";
    const abs = Math.abs(usd);
    if (ccy === "USD" || !fxRate) return `${s}$${fmt(abs)}`;
    return `${s}฿${fmt(abs * fxRate)}`;
  };
  const sym = ccy === "USD" ? "$" : "฿";

  const calc = useMemo(() => {
    const a = n(avgCost);
    const tc = n(totalCost);
    const cp = n(currentPrice);
    const bUsd = n(buyUsd);

    const currentShares = a > 0 ? tc / a : 0;
    const currentValue = currentShares * cp;
    const unrealizedPnl = currentValue - tc;
    const unrealizedPct = tc > 0 ? (unrealizedPnl / tc) * 100 : 0;

    const newShares = cp > 0 ? bUsd / cp : 0;
    const totalShares = currentShares + newShares;
    const newTotalCost = tc + bUsd;
    const newAvgCost = totalShares > 0 ? newTotalCost / totalShares : 0;
    const avgChange = newAvgCost - a;
    const avgChangePct = a > 0 ? (avgChange / a) * 100 : 0;
    const newMarketValue = totalShares * cp;
    const newUnrealizedPnl = newMarketValue - newTotalCost;
    const newUnrealizedPct = newTotalCost > 0 ? (newUnrealizedPnl / newTotalCost) * 100 : 0;

    return {
      currentShares,
      currentValue,
      unrealizedPnl,
      unrealizedPct,
      newShares,
      totalShares,
      newTotalCost,
      newAvgCost,
      avgChange,
      avgChangePct,
      newMarketValue,
      newUnrealizedPnl,
      newUnrealizedPct,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgCost, totalCost, currentPrice, buyUsd, buyKey]);

  const sell = useMemo(() => {
    const sp = n(sellPrice);
    const sharesAvailable = calc.totalShares;
    const ss =
      n(sellShares) > 0 ? Math.min(n(sellShares), sharesAvailable) : sharesAvailable;
    const proceeds = ss * sp;
    const costOfSold = ss * calc.newAvgCost;
    const profit = proceeds - costOfSold;
    const profitPct = costOfSold > 0 ? (profit / costOfSold) * 100 : 0;
    return { ss, proceeds, profit, profitPct, costOfSold };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellKey]);

  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      {/* ===== Space-themed background ===== */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.25_0.08_280)_0%,_oklch(0.12_0.04_270)_45%,_oklch(0.08_0.02_260)_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.55] [background-image:radial-gradient(1px_1px_at_20px_30px,white,transparent),radial-gradient(1px_1px_at_40px_70px,white,transparent),radial-gradient(1.5px_1.5px_at_90px_40px,white,transparent),radial-gradient(1px_1px_at_130px_80px,white,transparent),radial-gradient(1px_1px_at_160px_120px,white,transparent),radial-gradient(2px_2px_at_200px_50px,white,transparent),radial-gradient(1px_1px_at_240px_160px,white,transparent),radial-gradient(1px_1px_at_300px_90px,white,transparent),radial-gradient(1.5px_1.5px_at_360px_180px,white,transparent),radial-gradient(1px_1px_at_420px_30px,white,transparent)] [background-size:480px_240px] [background-repeat:repeat]" />
      <div className="pointer-events-none absolute -top-32 -right-32 -z-10 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 -z-10 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Floating currency toggle */}
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <div className="rounded-full border border-border/60 bg-background/70 p-1 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setCcy("USD")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              ccy === "USD"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            USD $
          </button>
          <button
            onClick={() => setCcy("THB")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              ccy === "THB"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            THB ฿
          </button>
        </div>
        <button
          onClick={refreshFx}
          disabled={fxLoading}
          title={fxRate ? `1 USD ≈ ${fmt(fxRate)} THB` : "Loading rate…"}
          className="flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-lg backdrop-blur-md hover:text-foreground"
        >
          <ArrowLeftRight className={`h-3 w-3 ${fxLoading ? "animate-spin" : ""}`} />
          {fxRate ? `1$ = ${fmt(fxRate)}฿` : "rate…"}
        </button>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-5">
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative rounded-lg bg-primary/15 p-2 text-primary ring-1 ring-primary/30">
              <Rocket className="h-4 w-4" />
              <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 text-fuchsia-300" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-base font-semibold leading-tight text-transparent">
                Cost Basis Calculator
              </h1>
              <p className="text-[11px] text-muted-foreground">
                เครื่องคำนวณต้นทุนเฉลี่ย · ซิงค์ราคาตลาด · จำลองการขาย
              </p>
            </div>
          </div>
          {syncMsg && (
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] ${
                syncMsg.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {syncMsg.text}
            </span>
          )}
        </header>

        {/* ===== SECTION A — Inputs + Live Results ===== */}
        <Card className="mb-4 border-border/60 bg-card/40 p-5 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Inputs */}
            <div className="space-y-4">
              <SectionTitle
                step="1"
                title="Your Position & Buy"
                thai="ข้อมูลและการซื้อเพิ่ม"
                icon={<Wallet className="h-4 w-4" />}
              />

              {/* Ticker with autocomplete */}
              <div className="space-y-1" ref={sugBoxRef}>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ticker (สัญลักษณ์หุ้น)
                </Label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={ticker}
                      onChange={(e) => {
                        setTicker(e.target.value.toUpperCase());
                        setShowSug(true);
                      }}
                      onFocus={() => setShowSug(true)}
                      className="h-9 bg-background/60 pl-8 text-sm font-semibold tracking-wide"
                      placeholder="Type M, AAPL, TSLA..."
                      autoComplete="off"
                    />
                    {showSug && (suggestions.length > 0 || searching) && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-border/60 bg-popover/95 shadow-xl backdrop-blur-xl">
                        {searching && (
                          <div className="px-3 py-2 text-[11px] text-muted-foreground">
                            Searching…
                          </div>
                        )}
                        {suggestions.map((s) => (
                          <button
                            key={s.symbol}
                            type="button"
                            onClick={() => {
                              setTicker(s.symbol.toUpperCase());
                              setShowSug(false);
                              handleSync(s.symbol);
                            }}
                            className="flex w-full items-center justify-between gap-2 border-b border-border/30 px-3 py-2 text-left text-xs last:border-0 hover:bg-primary/10"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold tracking-wide">
                                {s.symbol}
                              </span>
                              <span className="truncate text-[10px] text-muted-foreground">
                                {s.name}
                              </span>
                            </div>
                            <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                              {s.exch || s.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSync()}
                    disabled={syncing}
                    className="h-9 gap-1.5 px-3"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                    />
                    Sync
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Existing Position (หุ้นที่ถืออยู่)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Avg / share"
                    thai="ต้นทุนต่อหุ้น"
                    value={avgCost}
                    onChange={setAvgCost}
                    prefix="$"
                    hint={fxRate ? `≈ ฿${fmt(n(avgCost) * fxRate)}` : undefined}
                  />
                  <NumField
                    label="Total cost"
                    thai="ต้นทุนรวม"
                    value={totalCost}
                    onChange={setTotalCost}
                    prefix="$"
                    hint={`≈ ${fmtShares(n(totalCost) / (n(avgCost) || 1))} sh${fxRate ? ` · ฿${fmt(n(totalCost) * fxRate)}` : ""}`}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Buy More (ซื้อเพิ่ม)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Current price"
                    thai="ราคาปัจจุบัน"
                    value={currentPrice}
                    onChange={setCurrentPrice}
                    prefix="$"
                    hint={fxRate ? `≈ ฿${fmt(n(currentPrice) * fxRate)}` : undefined}
                  />
                  <NumField
                    label="Buy amount"
                    thai="จำนวนเงินที่ซื้อ (USD)"
                    value={buyUsd}
                    onChange={setBuyUsd}
                    prefix="$"
                    hint={fxRate ? `≈ ฿${fmt(n(buyUsd) * fxRate)}` : undefined}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {[15, 30, 45, 60, 75, 100, 150, 300].map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setBuyUsd(v)}
                    >
                      ${v}
                    </Button>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-sm"
                      onClick={() =>
                        setBuyUsd(Math.max(0, (n(buyUsd) || 0) - 15))
                      }
                      title="-15"
                    >
                      −
                    </Button>
                    <span className="text-[10px] text-muted-foreground">step 15</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-sm"
                      onClick={() => setBuyUsd((n(buyUsd) || 0) + 15)}
                      title="+15"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setBuyKey((k) => k + 1)}
                className="h-10 w-full gap-2"
              >
                <Calculator className="h-4 w-4" />
                Recalculate (คำนวณใหม่)
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Auto-updates live · กดปุ่มเพื่อรีเฟรชด้วยตนเอง
              </p>
            </div>

            {/* Results */}
            <div className="space-y-3">
              <SectionTitle
                step="2"
                title="Results"
                thai="ผลการคำนวณ"
                icon={<LineChart className="h-4 w-4" />}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-background/40 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current (ปัจจุบัน)
                  <span className="ml-1 text-[10px] font-normal opacity-70">
                    @ {sym}
                    {ccy === "USD" || !fxRate
                      ? fmt(n(currentPrice))
                      : fmt(n(currentPrice) * fxRate)}
                  </span>
                </div>
                <div className="rounded-md bg-primary/10 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-primary">
                  After Buy (หลังซื้อเพิ่ม)
                  <span className="ml-1 text-[10px] font-normal opacity-80">
                    +{money(n(buyUsd))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Row label="Shares" thai="หุ้น" value={fmtShares(calc.currentShares)} />
                <Row
                  label="Total shares"
                  thai="หุ้นรวม"
                  value={fmtShares(calc.totalShares)}
                  emphasize
                />

                <Row
                  label="Avg / share"
                  thai="ต้นทุน/หุ้น"
                  value={money(n(avgCost))}
                />
                <Row
                  label="New avg / share"
                  thai="ต้นทุนใหม่/หุ้น"
                  value={money(calc.newAvgCost)}
                  tone={calc.avgChange <= 0 ? "pos" : "neg"}
                  emphasize
                />

                <Row label="Total cost" thai="ต้นทุนรวม" value={money(n(totalCost))} />
                <Row
                  label="New total cost"
                  thai="ต้นทุนรวมใหม่"
                  value={money(calc.newTotalCost)}
                  emphasize
                />

                <Row
                  label="Market value"
                  thai="มูลค่าตลาด"
                  value={money(calc.currentValue)}
                />
                <Row
                  label="Market value"
                  thai="มูลค่าตลาด"
                  value={money(calc.newMarketValue)}
                  emphasize
                />

                <Row
                  label="Unrealized P/L"
                  thai="กำไร/ขาดทุน"
                  value={`${moneySigned(calc.unrealizedPnl)} (${calc.unrealizedPct.toFixed(2)}%)`}
                  tone={calc.unrealizedPnl >= 0 ? "pos" : "neg"}
                />
                <Row
                  label="Unrealized P/L"
                  thai="กำไร/ขาดทุน"
                  value={`${moneySigned(calc.newUnrealizedPnl)} (${calc.newUnrealizedPct.toFixed(2)}%)`}
                  tone={calc.newUnrealizedPnl >= 0 ? "pos" : "neg"}
                  emphasize
                />

                <div className="col-span-2 rounded-md border border-border/50 bg-background/30 px-3 py-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Δ Avg / share (ส่วนต่างต้นทุน):
                  </span>{" "}
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      calc.avgChange <= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {moneySigned(calc.avgChange)} ({calc.avgChangePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ===== SECTION B — Sell Simulator ===== */}
        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <SectionTitle
                step="3"
                title="Sell Simulator"
                thai="จำลองการขาย"
                icon={<DollarSign className="h-4 w-4" />}
              />

              <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Sell price"
                    thai="ราคาขาย"
                    value={sellPrice}
                    onChange={setSellPrice}
                    prefix="$"
                  />
                  <NumField
                    label="Shares to sell"
                    thai="จำนวนหุ้นที่ขาย"
                    value={sellShares}
                    onChange={setSellShares}
                    hint={`ว่าง = ขายทั้งหมด (${fmtShares(calc.totalShares)})`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[0.25, 0.5, 0.75, 1].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() =>
                        setSellShares(Number((calc.totalShares * p).toFixed(8)))
                      }
                    >
                      {p * 100}%
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setSellShares(0)}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => setSellKey((k) => k + 1)}
                variant="secondary"
                className="h-10 w-full gap-2 border border-primary/30 bg-primary/10 hover:bg-primary/20"
              >
                <DollarSign className="h-4 w-4" />
                Simulate Sell (คำนวณการขาย)
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Uses new avg / share = {money(calc.newAvgCost)}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sell Result (ผลการขาย)
                {sell.profit >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="ml-auto font-normal normal-case text-[10px] text-muted-foreground">
                  @ {money(n(sellPrice))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Row label="Shares sold" thai="หุ้นที่ขาย" value={fmtShares(sell.ss)} />
                <Row label="Proceeds" thai="เงินที่ได้รับ" value={money(sell.proceeds)} />
                <Row
                  label="Cost basis"
                  thai="ต้นทุนของหุ้นที่ขาย"
                  value={money(sell.costOfSold)}
                />
                <Row
                  label="% profit"
                  thai="กำไร %"
                  value={`${sell.profitPct.toFixed(2)}%`}
                  tone={sell.profit >= 0 ? "pos" : "neg"}
                />
              </div>

              <div
                className={`rounded-lg border px-4 py-3 ${
                  sell.profit >= 0
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-80">
                  Realized P/L (กำไร/ขาดทุนเมื่อขาย)
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {moneySigned(sell.profit)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <footer className="mt-4 text-center text-[10px] text-muted-foreground">
          Live prices & FX via Yahoo Finance · ไม่รวมค่าธรรมเนียม/ภาษี · For informational
          use only
        </footer>
      </div>
    </main>
  );
}
