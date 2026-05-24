import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("quick_replies")
      .select("*")
      .eq("user_id", userId)
      .order("shortcut");
    return data ?? [];
  });

export const upsertQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        shortcut: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/i),
        content: z.string().min(1).max(2000),
        media_url: z.string().url().optional().nullable(),
        media_type: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      await supabase.from("quick_replies").update(data).eq("id", data.id);
    } else {
      await supabase.from("quick_replies").insert({ ...data, user_id: userId });
    }
    return { ok: true };
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await context.supabase.from("quick_replies").delete().eq("id", data.id);
    return { ok: true };
  });
