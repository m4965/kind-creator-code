import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evoSendText } from "./evolution.server";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false });
    return data ?? [];
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversationId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    await supabase.from("conversations").update({ unread: 0 }).eq("id", data.conversationId);
    return msgs ?? [];
  });

export const toggleAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversationId: z.string().uuid(), enabled: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await supabase.from("conversations").update({ ai_enabled: data.enabled }).eq("id", data.conversationId);
    return { ok: true };
  });

export const sendManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ conversationId: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: conv } = await supabase
      .from("conversations")
      .select("*, contact:contacts(*)")
      .eq("id", data.conversationId)
      .single();
    const { data: settings } = await supabase.from("settings").select("*").eq("user_id", userId).single();
    if (settings && conv?.contact)
      await evoSendText(settings as any, (conv.contact as any).phone, data.text);
    await supabase.from("messages").insert({
      user_id: userId,
      conversation_id: data.conversationId,
      role: "assistant",
      type: "text",
      content: data.text,
    });
    return { ok: true };
  });
