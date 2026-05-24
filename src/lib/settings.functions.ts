import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
    return data;
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evolution_url: z.string().max(500).default(""),
        evolution_instance: z.string().max(200).default(""),
        evolution_key: z.string().max(500).default(""),
        groq_key: z.string().max(500).default(""),
        groq_model: z.string().max(200).default("llama-3.3-70b-versatile"),
        groq_audio_model: z.string().max(200).default("whisper-large-v3-turbo"),
        groq_vision_model: z.string().max(200).default("meta-llama/llama-4-scout-17b-16e-instruct"),
        system_prompt: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("settings").upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() });
    return { ok: true };
  });
