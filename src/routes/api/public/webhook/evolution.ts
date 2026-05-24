import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { groqChat, groqTranscribe } from "@/lib/groq.server";
import { evoSendText, downloadMedia } from "@/lib/evolution.server";
import { runFlow, type FlowNode, type FlowEdge } from "@/lib/flow-engine.server";

export const Route = createFileRoute("/api/public/webhook/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("user_id");
        if (!userId) return new Response("missing user_id", { status: 400 });

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }

        // Evolution: { event, instance, data: { key, message, messageType, pushName } }
        const evt = payload?.event ?? payload?.type;
        if (evt && !String(evt).includes("messages.upsert") && evt !== "messages.upsert") {
          return Response.json({ ok: true, ignored: evt });
        }

        const msg = payload?.data ?? payload;
        const remoteJid: string = msg?.key?.remoteJid ?? "";
        if (!remoteJid || msg?.key?.fromMe) return Response.json({ ok: true, skip: "fromMe" });
        const phone = remoteJid.replace(/@.*/, "");
        const pushName: string = msg?.pushName ?? phone;

        const m = msg?.message ?? {};
        let type: "text" | "image" | "audio" | "video" | "document" = "text";
        let content = "";
        let mediaUrl: string | null = null;

        if (m.conversation) {
          content = m.conversation;
        } else if (m.extendedTextMessage?.text) {
          content = m.extendedTextMessage.text;
        } else if (m.imageMessage) {
          type = "image";
          content = m.imageMessage.caption ?? "";
          mediaUrl = m.imageMessage.url ?? msg?.message?.imageMessage?.url ?? null;
        } else if (m.audioMessage) {
          type = "audio";
          mediaUrl = m.audioMessage.url ?? null;
        } else if (m.videoMessage) {
          type = "video";
          content = m.videoMessage.caption ?? "";
          mediaUrl = m.videoMessage.url ?? null;
        } else if (m.documentMessage) {
          type = "document";
          content = m.documentMessage.fileName ?? "";
          mediaUrl = m.documentMessage.url ?? null;
        }

        // Evolution often exposes media URL via base64 endpoint instead. Accept top-level if provided.
        if (!mediaUrl && msg?.message?.base64) mediaUrl = msg.message.base64;
        if (!mediaUrl && msg?.mediaUrl) mediaUrl = msg.mediaUrl;

        // load settings
        const { data: settings } = await supabaseAdmin
          .from("settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (!settings) return new Response("no settings", { status: 404 });

        // upsert contact
        const { data: contact } = await supabaseAdmin
          .from("contacts")
          .upsert(
            { user_id: userId, phone, name: pushName },
            { onConflict: "user_id,phone", ignoreDuplicates: false },
          )
          .select()
          .single();

        // upsert conversation
        let { data: conv } = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("user_id", userId)
          .eq("contact_id", contact!.id)
          .maybeSingle();
        if (!conv) {
          const ins = await supabaseAdmin
            .from("conversations")
            .insert({ user_id: userId, contact_id: contact!.id })
            .select()
            .single();
          conv = ins.data!;
        }

        // transcribe audio
        let transcript: string | null = null;
        if (type === "audio" && mediaUrl && settings.groq_key) {
          try {
            const buf = await downloadMedia(mediaUrl as string);
            transcript = await groqTranscribe(
              settings.groq_key,
              settings.groq_audio_model ?? "whisper-large-v3-turbo",
              buf,
              "audio.ogg",
            );
          } catch (e) {
            console.error("transcribe", e);
          }
        }

        const { data: savedMsg } = await supabaseAdmin
          .from("messages")
          .insert({
            user_id: userId,
            conversation_id: conv.id,
            role: "user",
            type,
            content,
            media_url: mediaUrl,
            transcript,
          })
          .select()
          .single();

        const effective = transcript || content;

        // find matching flow
        const { data: flows } = await supabaseAdmin
          .from("flows")
          .select("*")
          .eq("user_id", userId)
          .eq("active", true);

        const matched = (flows ?? []).find((f) => {
          if (f.trigger_type === "any") return true;
          const kws = (f.trigger_keywords as string[]) ?? [];
          if (!kws.length) return false;
          const lower = effective.toLowerCase();
          return kws.some((k) => lower.includes(k.toLowerCase()));
        });

        if (matched) {
          await runFlow(
            { nodes: matched.nodes as FlowNode[], edges: matched.edges as FlowEdge[] },
            {
              userId,
              conversationId: conv.id,
              contactPhone: phone,
              messageId: savedMsg!.id,
              messageType: type,
              messageContent: effective,
              mediaUrl,
              settings: settings as any,
            },
          );
        } else if (conv.ai_enabled && settings.groq_key) {
          // free-form AI reply
          const { data: hist } = await supabaseAdmin
            .from("messages")
            .select("role,content,transcript,type")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(15);
          const history = (hist ?? [])
            .reverse()
            .map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.transcript || m.content || `[${m.type}]`,
            }));
          try {
            const reply = await groqChat(settings.groq_key, settings.groq_model ?? "llama-3.3-70b-versatile", [
              { role: "system", content: settings.system_prompt ?? "" },
              ...history,
            ]);
            await evoSendText(settings as any, phone, reply ?? "");
            await supabaseAdmin.from("messages").insert({
              user_id: userId,
              conversation_id: conv.id,
              role: "assistant",
              type: "text",
              content: reply,
            });
          } catch (e) {
            console.error("ai reply", e);
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
