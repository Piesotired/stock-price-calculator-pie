import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart,
} from "lucide-react";
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

function Stat({
  label,
  thai,
  value,
  tone,
}: {
  label: string;
  thai?: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
        ? "text-red-400"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5">
      <div className="flex items-baseline gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {thai && (
          <span className="normal-case tracking-normal opacity-70">({thai})</span>
        )}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${color}`}>{value}</div>
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

  const [ticker, setTicker] = useState("META");
  const [avgCost, setAvgCost] = useState<Num>(597);
  const [totalCost, setTotalCost] = useState<Num>(69.93);
  const [currentPrice, setCurrentPrice] = useState<Num>(610);
  const [buyUsd, setBuyUsd] = useState<Num>(50);
  const [sellPrice, setSellPrice] = useState<Num>(620);
  const [sellShares, setSellShares] = useState<Num>(0);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recalcKey, setRecalcKey] = useState(0);

  // Force dark mode for this page
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!had) root.classList.remove("dark");
    };
  }, []);

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
        setSyncMsg({ ok: false, text: `Sync failed: ${res.error}` });
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
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-5">
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-2 text-primary ring-1 ring-primary/20">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Cost Basis Calculator
              </h1>
              <p className="text-[11px] text-muted-foreground">
                เครื่องคำนวณต้นทุนเฉลี่ย · ซิงค์ราคาตลาด · จำลองการขาย
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              size="sm"
              onClick={() => setRecalcKey((k) => k + 1)}
              className="h-9 gap-1.5"
            >
              <Calculator className="h-3.5 w-3.5" />
              Calculate (คำนวณ)
            </Button>
          </div>
        </header>

        {/* Two main boxes */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ===== BOX 1 — Inputs ===== */}
          <Card className="flex flex-col gap-4 border-border/60 bg-card/40 p-5 backdrop-blur">
            <SectionTitle
              step="1"
              title="Your Inputs"
              thai="กรอกข้อมูลของคุณ"
              icon={<Wallet className="h-4 w-4" />}
            />

            {/* Ticker */}
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Ticker (สัญลักษณ์หุ้น)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="h-9 bg-background/60 text-sm font-semibold tracking-wide"
                  placeholder="e.g. META"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-9 gap-1.5 px-3"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  Sync
                </Button>
              </div>
            </div>

            {/* Existing position */}
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
                />
                <NumField
                  label="Total cost"
                  thai="ต้นทุนรวม"
                  value={totalCost}
                  onChange={setTotalCost}
                  prefix="$"
                  hint={`≈ ${fmtShares(n(totalCost) / (n(avgCost) || 1))} shares (หุ้น)`}
                />
              </div>
            </div>

            {/* Buy more */}
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
                  hint="Sync หรือกรอกเอง"
                />
                <NumField
                  label="Buy amount"
                  thai="จำนวนเงินที่ซื้อ"
                  value={buyUsd}
                  onChange={setBuyUsd}
                  prefix="$"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[50, 100, 250, 500, 1000].map((v) => (
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
              </div>
            </div>

            {/* Sell simulator inputs */}
            <div className="rounded-lg border border-border/50 bg-background/30 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sell Simulator (จำลองการขาย)
              </div>
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
          </Card>

          {/* ===== BOX 2 — Results ===== */}
          <Card className="flex flex-col gap-4 border-border/60 bg-card/40 p-5 backdrop-blur">
            <SectionTitle
              step="2"
              title="Results"
              thai="ผลการคำนวณ"
              icon={<LineChart className="h-4 w-4" />}
            />

            {/* Current vs After side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current */}
              <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Current (ปัจจุบัน)
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    @ ${fmt(n(currentPrice))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Stat
                    label="Shares"
                    thai="หุ้น"
                    value={fmtShares(calc.currentShares)}
                  />
                  <Stat
                    label="Avg / share"
                    thai="ต้นทุน/หุ้น"
                    value={`$${fmt(n(avgCost))}`}
                  />
                  <Stat
                    label="Total cost"
                    thai="ต้นทุนรวม"
                    value={`$${fmt(n(totalCost))}`}
                  />
                  <Stat
                    label="Market value"
                    thai="มูลค่าตลาด"
                    value={`$${fmt(calc.currentValue)}`}
                  />
                  <Stat
                    label="Unrealized P/L"
                    thai="กำไร/ขาดทุน"
                    value={`${calc.unrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.unrealizedPnl)} (${calc.unrealizedPct.toFixed(2)}%)`}
                    tone={calc.unrealizedPnl >= 0 ? "pos" : "neg"}
                  />
                </div>
              </div>

              {/* After */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    After Buy (หลังซื้อเพิ่ม)
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    +${fmt(n(buyUsd))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Stat
                    label="Shares bought"
                    thai="หุ้นที่ซื้อ"
                    value={fmtShares(calc.newShares)}
                  />
                  <Stat
                    label="Total shares"
                    thai="หุ้นรวม"
                    value={fmtShares(calc.totalShares)}
                  />
                  <Stat
                    label="New avg / share"
                    thai="ต้นทุนใหม่/หุ้น"
                    value={`$${fmt(calc.newAvgCost)}`}
                    tone={calc.avgChange <= 0 ? "pos" : "neg"}
                  />
                  <Stat
                    label="New total cost"
                    thai="ต้นทุนรวมใหม่"
                    value={`$${fmt(calc.newTotalCost)}`}
                  />
                  <Stat
                    label="Δ avg / share"
                    thai="ส่วนต่างต้นทุน"
                    value={`${calc.avgChange >= 0 ? "+" : ""}$${fmt(calc.avgChange)} (${calc.avgChangePct.toFixed(2)}%)`}
                    tone={calc.avgChange <= 0 ? "pos" : "neg"}
                  />
                  <Stat
                    label="Unrealized P/L"
                    thai="กำไร/ขาดทุน"
                    value={`${calc.newUnrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.newUnrealizedPnl)} (${calc.newUnrealizedPct.toFixed(2)}%)`}
                    tone={calc.newUnrealizedPnl >= 0 ? "pos" : "neg"}
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* Sell result */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sell Result (ผลการขาย)
                {sell.profit >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground">
                  @ ${fmt(n(sellPrice))} · จาก new avg ${fmt(calc.newAvgCost)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Shares sold" thai="หุ้นที่ขาย" value={fmtShares(sell.ss)} />
                <Stat
                  label="Proceeds"
                  thai="เงินที่ได้รับ"
                  value={`$${fmt(sell.proceeds)}`}
                />
                <Stat
                  label="Cost basis"
                  thai="ต้นทุนของหุ้นที่ขาย"
                  value={`$${fmt(sell.costOfSold)}`}
                />
                <Stat
                  label="% profit"
                  thai="กำไร %"
                  value={`${sell.profitPct.toFixed(2)}%`}
                  tone={sell.profit >= 0 ? "pos" : "neg"}
                />
                <div className="col-span-2">
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
                      {sell.profit >= 0 ? "+" : ""}${fmt(sell.profit)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <footer className="mt-4 text-center text-[10px] text-muted-foreground">
          Live prices via Yahoo Finance · ไม่รวมค่าธรรมเนียม/ภาษี · For informational use
          only
        </footer>
      </div>
    </main>
  );
}
