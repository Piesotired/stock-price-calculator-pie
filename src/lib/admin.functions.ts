// Admin-only server functions. Every handler re-checks the admin role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateApiKey, hashKey } from "./api-key.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [holdings, keys, logs, profiles] = await Promise.all([
      supabaseAdmin.from("holdings").select("*").order("symbol"),
      supabaseAdmin
        .from("api_keys")
        .select("id, name, key_prefix, revoked, last_used_at, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("api_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("profiles").select("id, email, display_name, created_at"),
    ]);
    return {
      holdings: holdings.data ?? [],
      apiKeys: keys.data ?? [],
      logs: logs.data ?? [],
      profiles: profiles.data ?? [],
    };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { key, prefix } = generateApiKey();
    const key_hash = await hashKey(key);
    const { error } = await supabaseAdmin.from("api_keys").insert({
      name: data.name,
      key_hash,
      key_prefix: prefix,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    // Return the raw key ONCE — never stored
    return { key, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    symbol: string;
    avg_cost: number;
    total_cost: number;
    notes?: string | null;
  }) =>
    z
      .object({
        symbol: z.string().min(1).max(16).regex(/^[A-Za-z0-9.\-]+$/),
        avg_cost: z.number().nonnegative(),
        total_cost: z.number().nonnegative(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const row = { ...data, symbol: data.symbol.toUpperCase() };
    const { data: result, error } = await supabaseAdmin
      .from("holdings")
      .upsert(row, { onConflict: "symbol" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { symbol: string }) =>
    z.object({ symbol: z.string().min(1).max(16) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("holdings")
      .delete()
      .eq("symbol", data.symbol.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkAmAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data, userId: context.userId };
  });
