import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifyApiKeyFromRequest,
  logRequest,
  json,
  corsPreflight,
} from "@/lib/api-key.server";

const HoldingPatch = z.object({
  avg_cost: z.number().nonnegative().optional(),
  total_cost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/holdings/$symbol")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const symbol = params.symbol.toUpperCase();
        const path = `/api/public/v1/holdings/${symbol}`;
        const { data, error } = await supabaseAdmin
          .from("holdings")
          .select("*")
          .eq("symbol", symbol)
          .maybeSingle();
        if (error) {
          await logRequest(request, 500, path);
          return json({ error: error.message }, 500);
        }
        if (!data) {
          await logRequest(request, 404, path);
          return json({ error: "Not found" }, 404);
        }
        await logRequest(request, 200, path);
        return json({ data });
      },
      PUT: async ({ request, params }) => {
        const symbol = params.symbol.toUpperCase();
        const path = `/api/public/v1/holdings/${symbol}`;
        const key = await verifyApiKeyFromRequest(request);
        if (!key) {
          await logRequest(request, 401, path);
          return json({ error: "Missing or invalid API key" }, 401);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          await logRequest(request, 400, path, key.prefix);
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = HoldingPatch.safeParse(body);
        if (!parsed.success) {
          await logRequest(request, 400, path, key.prefix);
          return json({ error: "Validation failed", issues: parsed.error.issues }, 400);
        }
        const { data, error } = await supabaseAdmin
          .from("holdings")
          .update(parsed.data)
          .eq("symbol", symbol)
          .select()
          .maybeSingle();
        if (error) {
          await logRequest(request, 500, path, key.prefix);
          return json({ error: error.message }, 500);
        }
        if (!data) {
          await logRequest(request, 404, path, key.prefix);
          return json({ error: "Not found" }, 404);
        }
        await logRequest(request, 200, path, key.prefix);
        return json({ data });
      },
      DELETE: async ({ request, params }) => {
        const symbol = params.symbol.toUpperCase();
        const path = `/api/public/v1/holdings/${symbol}`;
        const key = await verifyApiKeyFromRequest(request);
        if (!key) {
          await logRequest(request, 401, path);
          return json({ error: "Missing or invalid API key" }, 401);
        }
        const { error, count } = await supabaseAdmin
          .from("holdings")
          .delete({ count: "exact" })
          .eq("symbol", symbol);
        if (error) {
          await logRequest(request, 500, path, key.prefix);
          return json({ error: error.message }, 500);
        }
        if (!count) {
          await logRequest(request, 404, path, key.prefix);
          return json({ error: "Not found" }, 404);
        }
        await logRequest(request, 200, path, key.prefix);
        return json({ ok: true });
      },
    },
  },
});
