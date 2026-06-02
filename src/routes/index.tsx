import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cost Basis Calculator — Recalculate Average Cost & Profit" },
      {
        name: "description",
        content:
          "Calculate new average cost per share when buying more, and simulate profit when selling at any price.",
      },
    ],
  }),
  component: Index,
});

type Num = number | "";

const n = (v: Num) => (typeof v === "number" && !isNaN(v) ? v : 0);
const fmt = (v: number, d = 4) =>
  isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 2 }) : "—";

function Field({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  hint?: string;
  value: Num;
  onChange: (v: Num) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
          className={`${prefix ? "pl-8" : ""} ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "neutral" }) {
  const color =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Index() {
  // Existing position
  const [ticker, setTicker] = useState("META");
  const [avgCost, setAvgCost] = useState<Num>(597);
  const [totalCost, setTotalCost] = useState<Num>(69.93);

  // Current market
  const [currentPrice, setCurrentPrice] = useState<Num>(610);

  // Buy more
  const [buyUsd, setBuyUsd] = useState<Num>(50);

  // Sell scenario
  const [sellPrice, setSellPrice] = useState<Num>(620);
  const [sellShares, setSellShares] = useState<Num>(0);

  const calc = useMemo(() => {
    const a = n(avgCost);
    const tc = n(totalCost);
    const cp = n(currentPrice);
    const bUsd = n(buyUsd);

    const currentShares = a > 0 ? tc / a : 0;
    const currentValue = currentShares * cp;
    const unrealizedPnl = currentValue - tc;
    const unrealizedPct = tc > 0 ? (unrealizedPnl / tc) * 100 : 0;

    // Buying more at current price
    const newShares = cp > 0 ? bUsd / cp : 0;
    const totalShares = currentShares + newShares;
    const newTotalCost = tc + bUsd;
    const newAvgCost = totalShares > 0 ? newTotalCost / totalShares : 0;
    const avgChange = newAvgCost - a;
    const avgChangePct = a > 0 ? (avgChange / a) * 100 : 0;

    // Profit if we sold at the new average after this buy (vs current price)
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
  }, [avgCost, totalCost, currentPrice, buyUsd]);

  const sell = useMemo(() => {
    const sp = n(sellPrice);
    // default to ALL shares (post-buy) if user leaves sellShares = 0
    const sharesAvailable = calc.totalShares;
    const ss = n(sellShares) > 0 ? Math.min(n(sellShares), sharesAvailable) : sharesAvailable;
    const proceeds = ss * sp;
    const costOfSold = ss * calc.newAvgCost;
    const profit = proceeds - costOfSold;
    const profitPct = costOfSold > 0 ? (profit / costOfSold) * 100 : 0;
    return { ss, proceeds, profit, profitPct, costOfSold };
  }, [sellPrice, sellShares, calc.totalShares, calc.newAvgCost]);

  return (
    <main className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Cost Basis Calculator</h1>
          <p className="mt-2 text-muted-foreground">
            ดูต้นทุนเฉลี่ยใหม่ (average cost) เมื่อซื้อเพิ่ม และคำนวณกำไร/ขาดทุนเมื่อขายในราคาที่ต้องการ
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Existing Position</CardTitle>
              <CardDescription>หุ้นที่คุณถืออยู่ตอนนี้</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Ticker</Label>
                <Input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
              </div>
              <Field
                label="ต้นทุนต่อหุ้น (Avg cost / share)"
                value={avgCost}
                onChange={setAvgCost}
                prefix="$"
              />
              <Field
                label="ต้นทุนรวม (Total cost)"
                value={totalCost}
                onChange={setTotalCost}
                prefix="$"
                hint={`= ${fmt(n(totalCost) / (n(avgCost) || 1), 6)} shares`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Current Market & Buy More</CardTitle>
              <CardDescription>กรอกราคาตลาดและจำนวนเงินที่จะซื้อเพิ่ม</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Current price ($/share)"
                value={currentPrice}
                onChange={setCurrentPrice}
                prefix="$"
              />
              <Field
                label="Buy amount (USD)"
                value={buyUsd}
                onChange={setBuyUsd}
                prefix="$"
                hint="ใส่ 0 ถ้ายังไม่ต้องการซื้อเพิ่ม"
              />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>{ticker} @ ${fmt(n(currentPrice))}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Before buying more</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Shares held" value={fmt(calc.currentShares, 6)} />
                <Stat label="Market value" value={`$${fmt(calc.currentValue)}`} />
                <Stat
                  label="Unrealized P/L"
                  value={`${calc.unrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.unrealizedPnl)} (${calc.unrealizedPct.toFixed(2)}%)`}
                  tone={calc.unrealizedPnl >= 0 ? "pos" : "neg"}
                />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                After buying ${fmt(n(buyUsd))} at ${fmt(n(currentPrice))}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Shares bought" value={fmt(calc.newShares, 6)} />
                <Stat label="Total shares" value={fmt(calc.totalShares, 6)} />
                <Stat label="New total cost" value={`$${fmt(calc.newTotalCost)}`} />
                <Stat
                  label="New avg cost"
                  value={`$${fmt(calc.newAvgCost)}`}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Δ Avg cost / share"
                  value={`${calc.avgChange >= 0 ? "+" : ""}$${fmt(calc.avgChange)} (${calc.avgChangePct.toFixed(2)}%)`}
                  tone={calc.avgChange <= 0 ? "pos" : "neg"}
                />
                <Stat
                  label="Unrealized P/L (new)"
                  value={`${calc.newUnrealizedPnl >= 0 ? "+" : ""}$${fmt(calc.newUnrealizedPnl)} (${calc.newUnrealizedPct.toFixed(2)}%)`}
                  tone={calc.newUnrealizedPnl >= 0 ? "pos" : "neg"}
                />
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Sell Simulator</CardTitle>
            <CardDescription>
              ลองขายที่ราคาเป้าหมาย — คิดจากต้นทุนเฉลี่ยใหม่ (${fmt(calc.newAvgCost)}) หลังจากซื้อเพิ่ม
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Sell price ($/share)"
                value={sellPrice}
                onChange={setSellPrice}
                prefix="$"
              />
              <Field
                label="Shares to sell"
                value={sellShares}
                onChange={setSellShares}
                hint={`ปล่อยว่างหรือ 0 = ขายทั้งหมด (${fmt(calc.totalShares, 6)} shares)`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => setSellShares(Number((calc.totalShares * p).toFixed(8)))}
                >
                  Sell {p * 100}%
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Shares sold" value={fmt(sell.ss, 6)} />
              <Stat label="Proceeds" value={`$${fmt(sell.proceeds)}`} />
              <Stat label="Cost basis sold" value={`$${fmt(sell.costOfSold)}`} />
              <Stat
                label="Realized P/L"
                value={`${sell.profit >= 0 ? "+" : ""}$${fmt(sell.profit)} (${sell.profitPct.toFixed(2)}%)`}
                tone={sell.profit >= 0 ? "pos" : "neg"}
              />
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ตัวเลขนี้ไม่รวมค่าธรรมเนียม / ภาษี. For informational purposes only.
        </p>
      </div>
    </main>
  );
}
