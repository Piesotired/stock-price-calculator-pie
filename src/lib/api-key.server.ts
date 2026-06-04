// Server-only helpers for API key hashing, verification, and request logging.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KEY_PREFIX = "cbk_live_";

export function generateApiKey(): { key: string; prefix: string } {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `${KEY_PREFIX}${hex}`;
  return { key, prefix: key.slice(0, 16) };
}

export async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type VerifiedKey = {
  id: string;
  prefix: string;
  name: string;
};

export async function verifyApiKeyFromRequest(request: Request): Promise<VerifiedKey | null> {
  const header = request.headers.get("x-api-key") || request.headers.get("authorization");
  if (!header) return null;
  const key = header.replace(/^Bearer\s+/i, "").trim();
  if (!key) return null;
  const key_hash = await hashKey(key);
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, key_prefix, name, revoked")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (!data || data.revoked) return null;
  // Fire-and-forget last_used update
  void supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id, prefix: data.key_prefix, name: data.name };
}

export async function logRequest(
  request: Request,
  status: number,
  path: string,
  keyPrefix?: string | null,
) {
  try {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    await supabaseAdmin.from("api_logs").insert({
      method: request.method,
      path,
      status,
      key_prefix: keyPrefix ?? null,
      ip,
    });
  } catch (e) {
    console.error("api_logs insert failed", e);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type, x-api-key, authorization",
    },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type, x-api-key, authorization",
    },
  });
}
