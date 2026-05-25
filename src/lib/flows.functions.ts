import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FlowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  active: z.boolean().default(true),
  trigger_type: z.enum(["keyword", "any"]).default("keyword"),
  trigger_keywords: z.array(z.string().max(100)).max(50).default([]),
  session_id: z.string().uuid().nullable().optional(),
  nodes: z.array(z.any()).max(200).default([]),
  edges: z.array(z.any()).max(500).default([]),
});

export const listFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("flows")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("flows").select("*").eq("id", data.id).single();
    return row;
  });

export const saveFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => FlowSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      await supabase.from("flows").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
      return { id: data.id };
    }
    const { data: created } = await supabase
      .from("flows")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    return { id: created!.id };
  });

export const deleteFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await context.supabase.from("flows").delete().eq("id", data.id);
    return { ok: true };
  });
