import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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

/** Row aligned by fixed height so left/right columns line up perfectly */
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

  const [ticker, setTicker] = useState("META");
  const [avgCost, setAvgCost] = useState<Num>(597);
  const [totalCost, setTotalCost] = useState<Num>(69.93);
  const [currentPrice, setCurrentPrice] = useState<Num>(610);
  const [buyUsd, setBuyUsd] = useState<Num>(50);
  const [sellPrice, setSellPrice] = useState<Num>(620);
  const [sellShares, setSellShares] = useState<Num>(0);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Recalc keys: separate for buy-side and sell-side
  const [buyKey, setBuyKey] = useState(0);
  const [sellKey, setSellKey] = useState(0);

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

  // Auto-live calc (buy side)
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

  // Sell calc — gated by its own button (sellKey)
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

        {/* ===== SECTION A — Inputs + Live Results (linked) ===== */}
        <Card className="mb-4 border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Inputs */}
            <div className="space-y-4">
              <SectionTitle
                step="1"
                title="Your Position & Buy"
                thai="ข้อมูลและการซื้อเพิ่ม"
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
                  />
                  <NumField
                    label="Total cost"
                    thai="ต้นทุนรวม"
                    value={totalCost}
                    onChange={setTotalCost}
                    prefix="$"
                    hint={`≈ ${fmtShares(n(totalCost) / (n(avgCost) || 1))} shares`}
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

              {/* Calculate button BELOW the inputs */}
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

            {/* Results — perfectly aligned rows */}
            <div className="space-y-3">
              <SectionTitle
                step="2"
                title="Results"
                thai="ผลการคำนวณ"
                icon={<LineChart className="h-4 w-4" />}
              />

              {/* Column headers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-background/40 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current (ปัจจุบัน)
                  <span className="ml-1 text-[10px] font-normal opacity-70">
                    @ ${fmt(n(currentPrice))}
                  </span>
                </div>
                <div className="rounded-md bg-primary/10 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-primary">
                  After Buy (หลังซื้อเพิ่ม)
                  <span className="ml-1 text-[10px] font-normal opacity-80">
                    +${fmt(n(buyUsd))}
                  </span>
                </div>
              </div>

              {/* Aligned rows: each row in Current ↔ After */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {/* Shares */}
                <Row
                  label="Shares"
                  thai="หุ้น"
                  value={fmtShares(calc.currentShares)}
                />
                <Row
                  label="Total shares"
                  thai="หุ้นรวม"
                  value={fmtShares(calc.totalShares)}
                  emphasize
                />

                {/* Avg / share */}
                <Row
                  label="Avg / share"
                  thai="ต้นทุน/หุ้น"
                  value={`$${fmt(n(avgCost))}`}
                />
                <Row
                  label="New avg / share"
                  thai="ต้นทุนใหม่/หุ้น"
                  value={`$${fmt(calc.newAvgCost)}`}
                  tone={calc.avgChange <= 0 ? "pos" : "neg"}
                  emphasize
                />

                {/* Total cost */}
                <Row
                  label="Total cost"
                  thai="ต้นทุนรวม"
                  value={`$${fmt(n(totalCost))}`}
                />
                <Row
                  label="New total cost"
                  thai="ต้นทุนรวมใหม่"
                  value={`$${fmt(calc.newTotalCost)}`}
                  emphasize
                />

                {/* Market value */}
                <Row
                  label="Market value"
                  thai="มูลค่าตลาด"
                  value={`$${fmt(calc.currentValue)}`}
                />
                <Row
                  label="Market value"
                  thai="มูลค่าตลาด"
                  value={`$${fmt(calc.newMarketValue)}`}
                  emphasize
                />

                {/* Unrealized P/L */}
                <Row
                  label="Unrealized P/L"
                  thai="กำไร/ขาดทุน"
                  value={`${calc.unrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.unrealizedPnl)} (${calc.unrealizedPct.toFixed(2)}%)`}
                  tone={calc.unrealizedPnl >= 0 ? "pos" : "neg"}
                />
                <Row
                  label="Unrealized P/L"
                  thai="กำไร/ขาดทุน"
                  value={`${calc.newUnrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.newUnrealizedPnl)} (${calc.newUnrealizedPct.toFixed(2)}%)`}
                  tone={calc.newUnrealizedPnl >= 0 ? "pos" : "neg"}
                  emphasize
                />

                {/* Δ avg — spans both for context */}
                <div className="col-span-2 rounded-md border border-border/50 bg-background/30 px-3 py-2 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Δ Avg / share (ส่วนต่างต้นทุน):
                  </span>{" "}
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      calc.avgChange <= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {calc.avgChange >= 0 ? "+" : ""}${fmt(calc.avgChange)} (
                    {calc.avgChangePct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ===== SECTION B — Sell Simulator (separate) ===== */}
        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Sell inputs */}
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

              {/* Dedicated Sell button */}
              <Button
                onClick={() => setSellKey((k) => k + 1)}
                variant="secondary"
                className="h-10 w-full gap-2 border border-primary/30 bg-primary/10 hover:bg-primary/20"
              >
                <DollarSign className="h-4 w-4" />
                Simulate Sell (คำนวณการขาย)
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Uses new avg / share = ${fmt(calc.newAvgCost)}
              </p>
            </div>

            {/* Sell results */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sell Result (ผลการขาย)
                {sell.profit >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span className="ml-auto font-normal normal-case text-[10px] text-muted-foreground">
                  @ ${fmt(n(sellPrice))}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Row label="Shares sold" thai="หุ้นที่ขาย" value={fmtShares(sell.ss)} />
                <Row
                  label="Proceeds"
                  thai="เงินที่ได้รับ"
                  value={`$${fmt(sell.proceeds)}`}
                />
                <Row
                  label="Cost basis"
                  thai="ต้นทุนของหุ้นที่ขาย"
                  value={`$${fmt(sell.costOfSold)}`}
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
                  {sell.profit >= 0 ? "+" : ""}${fmt(sell.profit)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <footer className="mt-4 text-center text-[10px] text-muted-foreground">
          Live prices via Yahoo Finance · ไม่รวมค่าธรรมเนียม/ภาษี · For informational use
          only
        </footer>
      </div>
    </main>
  );
}
