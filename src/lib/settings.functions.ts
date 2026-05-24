import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SAFE_COLS =
  "user_id, evolution_url, evolution_instance, groq_model, groq_audio_model, groq_vision_model, system_prompt, updated_at";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Use admin client to also read secret-key flags without exposing values
    const { data } = await supabaseAdmin
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    const { evolution_key, groq_key, ...safe } = data as any;
    return {
      ...safe,
      has_evolution_key: Boolean(evolution_key),
      has_groq_key: Boolean(groq_key),
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evolution_url: z.string().max(500).default(""),
        evolution_instance: z.string().max(200).default(""),
        evolution_key: z.string().max(500).optional(),
        groq_key: z.string().max(500).optional(),
        groq_model: z.string().max(200).default("llama-3.3-70b-versatile"),
        groq_audio_model: z.string().max(200).default("whisper-large-v3-turbo"),
        groq_vision_model: z.string().max(200).default("meta-llama/llama-4-scout-17b-16e-instruct"),
        system_prompt: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    // Only overwrite secret keys when a non-empty value is provided
    const patch: any = {
      user_id: userId,
      evolution_url: data.evolution_url,
      evolution_instance: data.evolution_instance,
      groq_model: data.groq_model,
      groq_audio_model: data.groq_audio_model,
      groq_vision_model: data.groq_vision_model,
      system_prompt: data.system_prompt,
      updated_at: new Date().toISOString(),
    };
    if (data.evolution_key && data.evolution_key.length > 0) patch.evolution_key = data.evolution_key;
    if (data.groq_key && data.groq_key.length > 0) patch.groq_key = data.groq_key;

    await supabaseAdmin.from("settings").upsert(patch, { onConflict: "user_id" });
    return { ok: true };
  });

