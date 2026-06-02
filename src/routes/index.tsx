import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { getQuote } from "@/lib/price.functions";

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

function NumField({
  label,
  value,
  onChange,
  prefix,
  hint,
  compact,
}: {
  label: string;
  value: Num;
  onChange: (v: Num) => void;
  prefix?: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
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
          className={`${prefix ? "pl-7" : ""} ${compact ? "h-8 text-sm" : "h-9 text-sm"}`}
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  small?: boolean;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-600"
      : tone === "neg"
        ? "text-red-600"
        : "text-foreground";
  return (
    <div className="rounded-md border bg-card/50 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`${small ? "text-sm" : "text-base"} font-semibold ${color}`}>
        {value}
      </div>
    </div>
  );
}

function Index() {
  const fetchQuote = useServerFn(getQuote);

  // Position
  const [ticker, setTicker] = useState("META");
  const [avgCost, setAvgCost] = useState<Num>(597);
  const [totalCost, setTotalCost] = useState<Num>(69.93);

  // Market
  const [currentPrice, setCurrentPrice] = useState<Num>(610);
  const [buyUsd, setBuyUsd] = useState<Num>(50);

  // Sell
  const [sellPrice, setSellPrice] = useState<Num>(620);
  const [sellShares, setSellShares] = useState<Num>(0);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Recalc trigger (calculator button) — increments to force re-eval
  const [recalcKey, setRecalcKey] = useState(0);

  async function handleSync() {
    if (!ticker.trim()) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetchQuote({ data: { symbol: ticker } });
      if (res.ok) {
        setCurrentPrice(Number(res.price.toFixed(4)));
        setSyncMsg({ ok: true, text: `${res.symbol} ${res.currency} ${fmt(res.price)}` });
      } else {
        setSyncMsg({ ok: false, text: `Sync failed: ${res.error}. Enter manually.` });
      }
    } catch (e: any) {
      setSyncMsg({ ok: false, text: `Sync failed: ${e?.message ?? "error"}` });
    } finally {
      setSyncing(false);
    }
  }

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
    const newUnrealizedPnl = totalShares * cp - newTotalCost;
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
      newUnrealizedPnl,
      newUnrealizedPct,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgCost, totalCost, currentPrice, buyUsd, recalcKey]);

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
  }, [sellPrice, sellShares, calc.totalShares, calc.newAvgCost]);

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/40">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col px-4 py-3">
        {/* Header */}
        <header className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Cost Basis Calculator</h1>
              <p className="text-[11px] text-muted-foreground">
                Live price sync · recalculate average cost · simulate sell profit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncMsg && (
              <span
                className={`text-[11px] ${syncMsg.ok ? "text-emerald-600" : "text-red-600"}`}
              >
                {syncMsg.text}
              </span>
            )}
            <Button
              size="sm"
              onClick={() => setRecalcKey((k) => k + 1)}
              className="h-8 gap-1.5"
            >
              <Calculator className="h-3.5 w-3.5" />
              Calculate
            </Button>
          </div>
        </header>

        {/* 3-column grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3">
          {/* Column 1 — Position */}
          <Card className="flex min-h-0 flex-col gap-3 p-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                1 · Existing Position
              </div>
              <p className="text-[10px] text-muted-foreground">
                หุ้นที่คุณถืออยู่ตอนนี้
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ticker
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="h-8 text-sm font-semibold"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSync}
                    disabled={syncing}
                    className="h-8 gap-1.5 px-2.5"
                    title="Sync live market price"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                    />
                    Sync
                  </Button>
                </div>
              </div>
              <NumField
                label="ต้นทุนต่อหุ้น (avg / share)"
                value={avgCost}
                onChange={setAvgCost}
                prefix="$"
                compact
              />
              <NumField
                label="ต้นทุนรวม (total cost)"
                value={totalCost}
                onChange={setTotalCost}
                prefix="$"
                hint={`= ${fmtShares(n(totalCost) / (n(avgCost) || 1))} shares`}
                compact
              />
            </div>

            <Separator />

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Current P/L
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Stat
                  label="Shares"
                  value={fmtShares(calc.currentShares)}
                  small
                />
                <Stat
                  label="Market value"
                  value={`$${fmt(calc.currentValue)}`}
                  small
                />
                <div className="col-span-2">
                  <Stat
                    label="Unrealized P/L"
                    value={`${calc.unrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.unrealizedPnl)}  (${calc.unrealizedPct.toFixed(2)}%)`}
                    tone={calc.unrealizedPnl >= 0 ? "pos" : "neg"}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Column 2 — Buy more */}
          <Card className="flex min-h-0 flex-col gap-3 p-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                2 · Market & Buy More
              </div>
              <p className="text-[10px] text-muted-foreground">
                ราคาตลาด + จำนวนเงินที่จะซื้อเพิ่ม
              </p>
            </div>

            <div className="space-y-2.5">
              <NumField
                label="Current price ($/share)"
                value={currentPrice}
                onChange={setCurrentPrice}
                prefix="$"
                compact
                hint="Auto-filled via Sync · editable as manual override"
              />
              <NumField
                label="Buy amount (USD)"
                value={buyUsd}
                onChange={setBuyUsd}
                prefix="$"
                compact
              />
              <div className="flex flex-wrap gap-1">
                {[50, 100, 250, 500, 1000].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setBuyUsd(v)}
                  >
                    ${v}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                After buying ${fmt(n(buyUsd))} @ ${fmt(n(currentPrice))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Stat label="Shares bought" value={fmtShares(calc.newShares)} small />
                <Stat label="Total shares" value={fmtShares(calc.totalShares)} small />
                <Stat label="New total" value={`$${fmt(calc.newTotalCost)}`} small />
                <Stat label="New avg" value={`$${fmt(calc.newAvgCost)}`} small />
                <div className="col-span-2">
                  <Stat
                    label="Δ avg / share"
                    value={`${calc.avgChange >= 0 ? "+" : ""}$${fmt(calc.avgChange)}  (${calc.avgChangePct.toFixed(2)}%)`}
                    tone={calc.avgChange <= 0 ? "pos" : "neg"}
                  />
                </div>
                <div className="col-span-2">
                  <Stat
                    label="Unrealized P/L (new)"
                    value={`${calc.newUnrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.newUnrealizedPnl)}  (${calc.newUnrealizedPct.toFixed(2)}%)`}
                    tone={calc.newUnrealizedPnl >= 0 ? "pos" : "neg"}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Column 3 — Sell simulator */}
          <Card className="flex min-h-0 flex-col gap-3 p-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                3 · Sell Simulator
              </div>
              <p className="text-[10px] text-muted-foreground">
                คิดจาก new avg ${fmt(calc.newAvgCost)}
              </p>
            </div>

            <div className="space-y-2.5">
              <NumField
                label="Sell price ($/share)"
                value={sellPrice}
                onChange={setSellPrice}
                prefix="$"
                compact
              />
              <NumField
                label="Shares to sell"
                value={sellShares}
                onChange={setSellShares}
                hint={`ว่าง / 0 = ขายทั้งหมด (${fmtShares(calc.totalShares)})`}
                compact
              />
              <div className="flex flex-wrap gap-1">
                {[0.25, 0.5, 0.75, 1].map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
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
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setSellShares(0)}
                >
                  Reset
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Result
                {sell.profit >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Stat label="Shares sold" value={fmtShares(sell.ss)} small />
                <Stat label="Proceeds" value={`$${fmt(sell.proceeds)}`} small />
                <Stat label="Cost basis" value={`$${fmt(sell.costOfSold)}`} small />
                <Stat
                  label="% profit"
                  value={`${sell.profitPct.toFixed(2)}%`}
                  tone={sell.profit >= 0 ? "pos" : "neg"}
                  small
                />
                <div className="col-span-2">
                  <div
                    className={`rounded-md border px-3 py-2 ${
                      sell.profit >= 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-80">
                      Realized P/L
                    </div>
                    <div className="text-lg font-bold">
                      {sell.profit >= 0 ? "+" : ""}${fmt(sell.profit)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <footer className="mt-2 text-center text-[10px] text-muted-foreground">
          Live prices via Yahoo Finance · ไม่รวมค่าธรรมเนียม/ภาษี · For informational use only
        </footer>
      </div>
    </main>
  );
}
