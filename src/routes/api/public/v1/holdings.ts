import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  verifyApiKeyFromRequest,
  logRequest,
  json,
  corsPreflight,
} from "@/lib/api-key.server";

const PATH = "/api/public/v1/holdings";

const HoldingInput = z.object({
  symbol: z.string().min(1).max(16).regex(/^[A-Za-z0-9.\-]+$/),
  avg_cost: z.number().nonnegative(),
  total_cost: z.number().nonnegative(),
  notes: z.string().max(1000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/holdings")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const { data, error } = await supabaseAdmin
          .from("holdings")
          .select("*")
          .order("symbol", { ascending: true });
        if (error) {
          await logRequest(request, 500, PATH);
          return json({ error: error.message }, 500);
        }
        await logRequest(request, 200, PATH);
        return json({ data });
      },
      POST: async ({ request }) => {
        const key = await verifyApiKeyFromRequest(request);
        if (!key) {
          await logRequest(request, 401, PATH);
          return json({ error: "Missing or invalid API key" }, 401);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          await logRequest(request, 400, PATH, key.prefix);
          return json({ error: "Invalid JSON" }, 400);
        }
        const parsed = HoldingInput.safeParse(body);
        if (!parsed.success) {
          await logRequest(request, 400, PATH, key.prefix);
          return json({ error: "Validation failed", issues: parsed.error.issues }, 400);
        }
        const row = { ...parsed.data, symbol: parsed.data.symbol.toUpperCase() };
        const { data, error } = await supabaseAdmin
          .from("holdings")
          .upsert(row, { onConflict: "symbol" })
          .select()
          .single();
        if (error) {
          await logRequest(request, 500, PATH, key.prefix);
          return json({ error: error.message }, 500);
        }
        await logRequest(request, 200, PATH, key.prefix);
        return json({ data });
      },
    },
  },
});
