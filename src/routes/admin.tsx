import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getAdminOverview,
  createApiKey,
  revokeApiKey,
  upsertHolding,
  deleteHolding,
  checkAmAdmin,
} from "@/lib/admin.functions";
import { Copy, KeyRound, LogOut, Plus, Trash2, X, BookOpen } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      if (!data.session) navigate({ to: "/auth" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!session) return null;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchAmAdmin = useServerFn(checkAmAdmin);
  const mCreateKey = useServerFn(createApiKey);
  const mRevoke = useServerFn(revokeApiKey);
  const mUpsert = useServerFn(upsertHolding);
  const mDelete = useServerFn(deleteHolding);

  const amAdmin = useQuery({ queryKey: ["amAdmin"], queryFn: () => fetchAmAdmin() });
  const overview = useQuery({
    queryKey: ["adminOverview"],
    queryFn: () => fetchOverview(),
    enabled: !!amAdmin.data?.isAdmin,
  });

  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const createKey = useMutation({
    mutationFn: (name: string) => mCreateKey({ data: { name } }),
    onSuccess: (r) => {
      setNewKey(r.key);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["adminOverview"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => mRevoke({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminOverview"] }),
  });
  const upsert = useMutation({
    mutationFn: (row: { symbol: string; avg_cost: number; total_cost: number; notes?: string | null }) =>
      mUpsert({ data: row }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminOverview"] }),
  });
  const del = useMutation({
    mutationFn: (symbol: string) => mDelete({ data: { symbol } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminOverview"] }),
  });

  if (amAdmin.isLoading) return <div className="p-8 text-muted-foreground">Checking access…</div>;
  if (amAdmin.error)
    return (
      <div className="p-8">
        <p className="text-destructive">Auth failed: {(amAdmin.error as Error).message}</p>
        <Button className="mt-4" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  if (!amAdmin.data?.isAdmin) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-xl mx-auto p-6 space-y-4">
          <h1 className="text-xl font-bold">Not an admin yet</h1>
          <p className="text-sm text-muted-foreground">
            Your user ID:{" "}
            <code className="bg-muted px-1 rounded">{amAdmin.data?.userId}</code>
          </p>
          <p className="text-sm">
            Open the Cloud dashboard → SQL editor and run this once, then refresh:
          </p>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${amAdmin.data?.userId}', 'admin')
ON CONFLICT DO NOTHING;`}</pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => amAdmin.refetch()}>Refresh</Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin</h1>
            <p className="text-sm text-muted-foreground">Holdings, API keys, and request logs</p>
          </div>
          <div className="flex gap-2">
            <Link to="/api-docs">
              <Button variant="outline" size="sm">
                <BookOpen className="w-4 h-4 mr-1" /> API docs
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="sm">App</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>

        {/* Holdings */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Holdings</h2>
            <Badge variant="outline">{data?.holdings.length ?? 0}</Badge>
          </div>
          <HoldingForm onSubmit={(v) => upsert.mutate(v)} busy={upsert.isPending} />
          {upsert.error && (
            <p className="text-sm text-destructive mt-2">{(upsert.error as Error).message}</p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Avg cost</th>
                  <th className="py-2 pr-3">Total cost</th>
                  <th className="py-2 pr-3">Shares</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data?.holdings.map((h) => {
                  const shares = h.avg_cost > 0 ? Number(h.total_cost) / Number(h.avg_cost) : 0;
                  return (
                    <tr key={h.id} className="border-b">
                      <td className="py-2 pr-3 font-mono font-semibold">{h.symbol}</td>
                      <td className="py-2 pr-3">${Number(h.avg_cost).toFixed(4)}</td>
                      <td className="py-2 pr-3">${Number(h.total_cost).toFixed(2)}</td>
                      <td className="py-2 pr-3">{shares.toFixed(4)}</td>
                      <td className="py-2 pr-3 max-w-xs truncate">{h.notes ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">
                        {new Date(h.updated_at).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => del.mutate(h.symbol)}
                          disabled={del.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data?.holdings.length && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No holdings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* API keys */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> API keys
            </h2>
            <Badge variant="outline">{data?.apiKeys.length ?? 0}</Badge>
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Key name (e.g. ai-agent-prod)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Button
              onClick={() => newKeyName && createKey.mutate(newKeyName)}
              disabled={!newKeyName || createKey.isPending}
            >
              <Plus className="w-4 h-4 mr-1" /> Create
            </Button>
          </div>
          {newKey && (
            <div className="border border-amber-500/40 bg-amber-500/10 rounded p-3 mb-3 space-y-2">
              <p className="text-xs text-amber-400">
                Copy this key now — it will never be shown again.
              </p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 font-mono text-sm break-all bg-background/50 p-2 rounded">
                  {newKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(newKey)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Prefix</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last used</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data?.apiKeys.map((k) => (
                  <tr key={k.id} className="border-b">
                    <td className="py-2 pr-3 font-medium">{k.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="py-2 pr-3">
                      {k.revoked ? (
                        <Badge variant="destructive">revoked</Badge>
                      ) : (
                        <Badge>active</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {!k.revoked && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revoke.mutate(k.id)}
                          disabled={revoke.isPending}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.apiKeys.length && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No keys yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Logs */}
        <Card className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Request log (last 100)</h2>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Path</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Key</th>
                  <th className="py-2 pr-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {data?.logs.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.method}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.path}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={l.status >= 400 ? "destructive" : "outline"}>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.key_prefix ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{l.ip ?? "—"}</td>
                  </tr>
                ))}
                {!data?.logs.length && (
                  <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function HoldingForm({
  onSubmit,
  busy,
}: {
  onSubmit: (v: { symbol: string; avg_cost: number; total_cost: number; notes?: string | null }) => void;
  busy: boolean;
}) {
  const [symbol, setSymbol] = useState("");
  const [avg, setAvg] = useState("");
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-5 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!symbol) return;
        onSubmit({
          symbol,
          avg_cost: Number(avg) || 0,
          total_cost: Number(total) || 0,
          notes: notes || null,
        });
        setSymbol(""); setAvg(""); setTotal(""); setNotes("");
      }}
    >
      <Input placeholder="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      <Input placeholder="Avg cost" type="number" step="any" value={avg} onChange={(e) => setAvg(e.target.value)} />
      <Input placeholder="Total cost" type="number" step="any" value={total} onChange={(e) => setTotal(e.target.value)} />
      <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button type="submit" disabled={busy}>
        <Plus className="w-4 h-4 mr-1" /> Save
      </Button>
    </form>
  );
}
