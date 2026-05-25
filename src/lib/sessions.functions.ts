import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SessionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  provider: z.enum(["evolution", "wppjs"]).default("evolution"),
  url: z.string().trim().max(500).default(""),
  instance: z.string().trim().max(120).default(""),
  api_key: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
});

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("whatsapp_sessions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    return data ?? [];
  });

export const saveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SessionSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      await supabase.from("whatsapp_sessions").update(data).eq("id", data.id);
      return { id: data.id };
    }
    const { data: row } = await supabase
      .from("whatsapp_sessions")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    return { id: row!.id };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await context.supabase.from("whatsapp_sessions").delete().eq("id", data.id);
    return { ok: true };
  });

export const rotateSessionSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    await context.supabase.from("whatsapp_sessions").update({ webhook_secret: secret }).eq("id", data.id);
    return { secret };
  });
