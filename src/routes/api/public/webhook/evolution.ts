import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { groqChat, groqTranscribe } from "@/lib/groq.server";
import { waSendText, waDownload, type WaSession } from "@/lib/wa.server";
import { runFlow, type FlowNode, type FlowEdge } from "@/lib/flow-engine.server";

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/webhook/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id");
        const secret = url.searchParams.get("secret") ?? "";
        const legacyUserId = url.searchParams.get("user_id");

        if (!sessionId && !legacyUserId) return new Response("missing session_id", { status: 400 });

        let session: WaSession | null = null;
        let userId: string;

        if (sessionId) {
          const { data } = await supabaseAdmin
            .from("whatsapp_sessions")
            .select("*")
            .eq("id", sessionId)
            .maybeSingle();
          if (!data) return new Response("session not found", { status: 404 });
          if (!data.active) return new Response("session disabled", { status: 403 });
          if (!secret || !timingSafeEqual(secret, data.webhook_secret)) {
            return new Response("invalid secret", { status: 401 });
          }
          userId = data.user_id;
          session = {
            id: data.id, user_id: data.user_id, provider: data.provider as any,
            url: data.url, instance: data.instance, api_key: data.api_key,
          };
        } else {
          userId = legacyUserId!;
        }

        let payload: any;
        try { payload = await request.json(); } catch { return new Response("bad json", { status: 400 }); }

        const evt = payload?.event ?? payload?.type;
        if (evt && !String(evt).includes("messages.upsert") && evt !== "messages.upsert") {
          return Response.json({ ok: true, ignored: evt });
        }

        const msg = payload?.data ?? payload;
        const remoteJid: string = msg?.key?.remoteJid ?? msg?.from ?? "";
        if (!remoteJid || msg?.key?.fromMe || msg?.fromMe) return Response.json({ ok: true, skip: "fromMe" });
        const phone = remoteJid.replace(/@.*/, "");
        const pushName: string = msg?.pushName ?? msg?.notifyName ?? phone;

        const m = msg?.message ?? msg?.body ? msg.message ?? {} : msg?.message ?? {};
        let type: "text" | "image" | "audio" | "video" | "document" = "text";
        let content = "";
        let mediaUrl: string | null = null;

        if (m.conversation) content = m.conversation;
        else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;
        else if (m.imageMessage) { type = "image"; content = m.imageMessage.caption ?? ""; mediaUrl = m.imageMessage.url ?? null; }
        else if (m.audioMessage) { type = "audio"; mediaUrl = m.audioMessage.url ?? null; }
        else if (m.videoMessage) { type = "video"; content = m.videoMessage.caption ?? ""; mediaUrl = m.videoMessage.url ?? null; }
        else if (m.documentMessage) { type = "document"; content = m.documentMessage.fileName ?? ""; mediaUrl = m.documentMessage.url ?? null; }
        else if (typeof msg?.body === "string") content = msg.body;

        if (!mediaUrl && msg?.mediaUrl) mediaUrl = msg.mediaUrl;

        const { data: settings } = await supabaseAdmin
          .from("settings").select("*").eq("user_id", userId).maybeSingle();
        if (!settings) return new Response("no settings", { status: 404 });
        if (!settings.groq_key && process.env.GROQ_API_KEY) (settings as any).groq_key = process.env.GROQ_API_KEY;

        // Legacy fallback session built from settings if no session row provided
        if (!session) {
          session = {
            id: "legacy", user_id: userId, provider: "evolution",
            url: settings.evolution_url ?? "", instance: settings.evolution_instance ?? "",
            api_key: settings.evolution_key ?? "",
          };
        }

        const { data: contact } = await supabaseAdmin
          .from("contacts")
          .upsert({ user_id: userId, phone, name: pushName }, { onConflict: "user_id,phone" })
          .select().single();

        let { data: conv } = await supabaseAdmin
          .from("conversations").select("*")
          .eq("user_id", userId).eq("contact_id", contact!.id).maybeSingle();
        if (!conv) {
          const ins = await supabaseAdmin.from("conversations")
            .insert({ user_id: userId, contact_id: contact!.id }).select().single();
          conv = ins.data!;
        }

        let transcript: string | null = null;
        if (type === "audio" && mediaUrl && settings.groq_key) {
          try {
            const buf = await waDownload(mediaUrl as string);
            transcript = await groqTranscribe(settings.groq_key,
              settings.groq_audio_model ?? "whisper-large-v3-turbo", buf, "audio.ogg");
          } catch (e) { console.error("transcribe", e); }
        }

        const { data: savedMsg } = await supabaseAdmin
          .from("messages")
          .insert({ user_id: userId, conversation_id: conv.id, role: "user", type, content, media_url: mediaUrl, transcript })
          .select().single();

        const effective = transcript || content;

        // Match flows scoped to this session (or unbound flows for legacy callers).
        let flowQ = supabaseAdmin.from("flows").select("*").eq("user_id", userId).eq("active", true);
        if (session.id !== "legacy") flowQ = flowQ.or(`session_id.eq.${session.id},session_id.is.null`);
        const { data: flows } = await flowQ;

        const matched = (flows ?? []).find((f) => {
          if (f.trigger_type === "any") return true;
          const kws = (f.trigger_keywords as string[]) ?? [];
          if (!kws.length) return false;
          const lower = effective.toLowerCase();
          return kws.some((k) => lower.includes(k.toLowerCase()));
        });

        const ai = {
          groq_key: settings.groq_key ?? "",
          groq_model: settings.groq_model ?? "llama-3.3-70b-versatile",
          groq_vision_model: settings.groq_vision_model ?? "meta-llama/llama-4-scout-17b-16e-instruct",
          system_prompt: settings.system_prompt ?? "",
        };

        if (matched) {
          await runFlow(
            { nodes: matched.nodes as FlowNode[], edges: matched.edges as FlowEdge[] },
            { userId, conversationId: conv.id, contactPhone: phone, messageId: savedMsg!.id,
              messageType: type, messageContent: effective, mediaUrl, session, ai },
          );
        } else if (conv.ai_enabled && ai.groq_key) {
          const { data: hist } = await supabaseAdmin
            .from("messages").select("role,content,transcript,type")
            .eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(15);
          const history = (hist ?? []).reverse().map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.transcript || m.content || `[${m.type}]`,
          }));
          try {
            const reply = await groqChat(ai.groq_key, ai.groq_model, [
              { role: "system", content: ai.system_prompt }, ...history,
            ]);
            await waSendText(session, phone, reply ?? "");
            await supabaseAdmin.from("messages").insert({
              user_id: userId, conversation_id: conv.id, role: "assistant", type: "text", content: reply,
            });
          } catch (e) { console.error("ai reply", e); }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
