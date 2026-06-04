import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [{ title: "API Docs — Cost Basis Calculator" }],
  }),
  component: ApiDocs,
});

function ApiDocs() {
  const [base, setBase] = useState("");
  useEffect(() => setBase(window.location.origin), []);

  const examples = [
    {
      title: "List all holdings (public)",
      method: "GET",
      path: "/api/public/v1/holdings",
      curl: `curl ${base}/api/public/v1/holdings`,
    },
    {
      title: "Get one holding (public)",
      method: "GET",
      path: "/api/public/v1/holdings/AAPL",
      curl: `curl ${base}/api/public/v1/holdings/AAPL`,
    },
    {
      title: "Create or upsert a holding (requires API key)",
      method: "POST",
      path: "/api/public/v1/holdings",
      curl: `curl -X POST ${base}/api/public/v1/holdings \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: cbk_live_..." \\
  -d '{"symbol":"AAPL","avg_cost":182.5,"total_cost":1825,"notes":"long-term"}'`,
    },
    {
      title: "Update a holding (requires API key)",
      method: "PUT",
      path: "/api/public/v1/holdings/AAPL",
      curl: `curl -X PUT ${base}/api/public/v1/holdings/AAPL \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: cbk_live_..." \\
  -d '{"avg_cost":190,"total_cost":2000}'`,
    },
    {
      title: "Delete a holding (requires API key)",
      method: "DELETE",
      path: "/api/public/v1/holdings/AAPL",
      curl: `curl -X DELETE ${base}/api/public/v1/holdings/AAPL \\
  -H "X-API-Key: cbk_live_..."`,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">API Reference</h1>
            <p className="text-sm text-muted-foreground">
              REST endpoints for your AI agent or anything else. Base URL:{" "}
              <code className="bg-muted px-1 rounded">{base}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
            <Link to="/"><Button variant="outline" size="sm">App</Button></Link>
          </div>
        </div>

        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Auth</h2>
          <p className="text-sm text-muted-foreground">
            <strong>GET</strong> endpoints are public. <strong>POST / PUT / DELETE</strong> require an API
            key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header
            (or <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code>). Create
            keys on the <Link to="/admin" className="text-primary hover:underline">admin page</Link>.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Data model</h2>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{`{
  "id": "uuid",
  "symbol": "AAPL",        // unique, uppercase, [A-Z0-9.-]
  "avg_cost": 182.5,        // number, >= 0  (USD per share)
  "total_cost": 1825,       // number, >= 0  (USD total invested)
  "notes": "long-term",     // string, optional, max 1000
  "created_at": "...",
  "updated_at": "..."
}`}</pre>
          <p className="text-xs text-muted-foreground">
            <code>shares</code> is implicit: <code>total_cost / avg_cost</code>.
          </p>
        </Card>

        {examples.map((ex) => (
          <Card key={ex.title} className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                  ex.method === "GET"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : ex.method === "DELETE"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {ex.method}
              </span>
              <code className="text-sm font-mono">{ex.path}</code>
            </div>
            <p className="text-sm font-medium">{ex.title}</p>
            <div className="relative">
              <pre className="text-xs bg-muted p-3 pr-10 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {ex.curl}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-1 right-1"
                onClick={() => navigator.clipboard.writeText(ex.curl)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}

        <Card className="p-5 space-y-2">
          <h2 className="text-lg font-semibold">Responses</h2>
          <p className="text-sm text-muted-foreground">
            Successful responses return <code>{"{ data: ... }"}</code>. Errors return{" "}
            <code>{"{ error: string }"}</code> with HTTP status 400 / 401 / 404 / 500.
          </p>
        </Card>
      </div>
    </div>
  );
}
