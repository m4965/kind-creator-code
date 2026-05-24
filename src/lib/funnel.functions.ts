import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: stages }, { data: leads }] = await Promise.all([
      supabase.from("funnel_stages").select("*").eq("user_id", userId).order("order"),
      supabase
        .from("leads")
        .select("*, contact:contacts(*)")
        .eq("user_id", userId)
        .order("order"),
    ]);
    return { stages: stages ?? [], leads: leads ?? [] };
  });

export const moveLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ leadId: z.string().uuid(), stageId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await context.supabase.from("leads").update({ stage_id: data.stageId }).eq("id", data.leadId);
    return { ok: true };
  });

export const upsertStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(60),
        color: z.string().regex(/^#[0-9a-f]{6}$/i),
        order: z.number().int().default(0),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      await supabase.from("funnel_stages").update(data).eq("id", data.id);
    } else {
      await supabase.from("funnel_stages").insert({ ...data, user_id: userId });
    }
    return { ok: true };
  });
