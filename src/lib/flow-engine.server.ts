import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { waSendText, waSendMedia, resolveMedia, type WaSession } from "./wa.server";
import { groqChat, groqVision } from "./groq.server";

export type FlowNode = { id: string; type: string; data: Record<string, unknown> };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null };

type AiSettings = {
  groq_key: string;
  groq_model: string;
  groq_vision_model: string;
  system_prompt: string;
};

type Ctx = {
  userId: string;
  conversationId: string;
  contactPhone: string;
  messageId: string;
  messageType: string;
  messageContent: string;
  mediaUrl: string | null;
  session: WaSession;
  ai: AiSettings;
};

function nextNodes(current: string, edges: FlowEdge[], handle?: string | null): string[] {
  return edges
    .filter((e) => e.source === current && (handle ? e.sourceHandle === handle : true))
    .map((e) => e.target);
}

async function saveAssistant(ctx: Ctx, content: string, type: "text" | "image" | "audio" | "video" | "document" = "text", mediaUrl?: string) {
  await supabaseAdmin.from("messages").insert({
    user_id: ctx.userId,
    conversation_id: ctx.conversationId,
    role: "assistant",
    type, content, media_url: mediaUrl,
  });
}

async function getHistory(conversationId: string, limit = 15) {
  const { data } = await supabaseAdmin
    .from("messages")
    .select("role,content,transcript,type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse().map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.transcript || m.content || `[${m.type}]`,
  }));
}

// Normalize an arbitrary node field into a list of media items.
// Accepts: string (single url/path), array of strings, array of {path,url,name}.
function asMediaList(v: unknown): Array<string | { path?: string; url?: string; name?: string }> {
  if (!v) return [];
  if (Array.isArray(v)) return v as any;
  if (typeof v === "string" && v.trim()) return [v];
  return [];
}

export async function runFlow(flow: { nodes: FlowNode[]; edges: FlowEdge[] }, ctx: Ctx) {
  const start = flow.nodes.find((n) => n.type === "trigger");
  if (!start) return;
  const visited = new Set<string>();
  const queue: Array<{ id: string }> = nextNodes(start.id, flow.edges).map((id) => ({ id }));
  while (queue.length) {
    const { id } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = flow.nodes.find((n) => n.id === id);
    if (!node) continue;
    let handle: string | null = null;
    try { handle = await runNode(node, ctx); } catch (e) { console.error("node", node.type, e); }
    for (const nxt of nextNodes(id, flow.edges, handle)) queue.push({ id: nxt });
  }
}

async function sendMediaList(
  ctx: Ctx, kind: "image" | "video" | "audio" | "document",
  list: Array<string | { path?: string; url?: string; name?: string }>,
  caption?: string,
) {
  for (let i = 0; i < list.length; i++) {
    const url = await resolveMedia(list[i] as any);
    if (!url) continue;
    const cap = i === 0 ? caption : undefined;
    await waSendMedia(ctx.session, ctx.contactPhone, kind, url, cap);
    await saveAssistant(ctx, cap ?? "", kind, url);
  }
}

async function runNode(node: FlowNode, ctx: Ctx): Promise<string | null> {
  const d = node.data as Record<string, any>;
  switch (node.type) {
    case "sendText": {
      const text = String(d.text ?? "");
      if (text) { await waSendText(ctx.session, ctx.contactPhone, text); await saveAssistant(ctx, text); }
      return null;
    }
    case "sendImage": {
      const list = asMediaList(d.items ?? d.urls ?? d.url);
      await sendMediaList(ctx, "image", list, d.caption);
      return null;
    }
    case "sendVideo": {
      const list = asMediaList(d.items ?? d.urls ?? d.url);
      await sendMediaList(ctx, "video", list, d.caption);
      return null;
    }
    case "sendAudio": {
      const list = asMediaList(d.items ?? d.urls ?? d.url);
      await sendMediaList(ctx, "audio", list);
      return null;
    }
    case "ai": {
      if (!ctx.ai.groq_key) return null;
      const history = await getHistory(ctx.conversationId);
      const reply = await groqChat(ctx.ai.groq_key, ctx.ai.groq_model, [
        { role: "system", content: d.prompt || ctx.ai.system_prompt },
        ...history,
      ]);
      await waSendText(ctx.session, ctx.contactPhone, reply);
      await saveAssistant(ctx, reply);
      return null;
    }
    case "condition": {
      const target = (ctx.messageContent || "").toLowerCase();
      const term = String(d.contains ?? "").toLowerCase();
      return term && target.includes(term) ? "true" : "false";
    }
    case "payment": {
      if (!ctx.mediaUrl || !ctx.ai.groq_key) return "rejected";
      const prompt = `Analise se a imagem é um comprovante de pagamento (PIX, TED, boleto). Responda APENAS em JSON:
{"is_receipt": true|false, "approved": true|false, "amount": number|null, "date": "YYYY-MM-DD"|null, "bank": "string"|null, "reason": "string"}
approved=true só se for comprovante real, com valor visível, parecendo legítimo.`;
      let extracted: any = {};
      let approved = false;
      try {
        const raw = await groqVision(ctx.ai.groq_key, ctx.ai.groq_vision_model, prompt, ctx.mediaUrl);
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) extracted = JSON.parse(m[0]);
        approved = !!extracted.approved && !!extracted.is_receipt;
      } catch (e) { console.error("payment vision", e); }
      await supabaseAdmin.from("payments").insert({
        user_id: ctx.userId, conversation_id: ctx.conversationId, message_id: ctx.messageId,
        status: approved ? "confirmed" : "rejected",
        amount: typeof extracted.amount === "number" ? extracted.amount : null,
        extracted, media_url: ctx.mediaUrl,
      });
      if (approved) {
        const msg = d.success_message || "✅ Pagamento confirmado! Segue o acesso:";
        await waSendText(ctx.session, ctx.contactPhone, msg);
        await saveAssistant(ctx, msg);
        const files = asMediaList(d.files ?? d.pdfs ?? d.pdf_urls ?? d.pdf_url);
        await sendMediaList(ctx, "document", files);
        const links = asMediaList(d.links ?? d.link);
        for (const l of links) {
          const url = typeof l === "string" ? l : l.url;
          if (url) { await waSendText(ctx.session, ctx.contactPhone, url); await saveAssistant(ctx, url); }
        }
      }
      return approved ? "approved" : "rejected";
    }
    case "moveFunnel": {
      const stageId = d.stage_id;
      if (!stageId) return null;
      const { data: contact } = await supabaseAdmin
        .from("conversations").select("contact_id").eq("id", ctx.conversationId).maybeSingle();
      if (contact?.contact_id) {
        const { data: existing } = await supabaseAdmin
          .from("leads").select("id").eq("contact_id", contact.contact_id).maybeSingle();
        if (existing) await supabaseAdmin.from("leads").update({ stage_id: stageId }).eq("id", existing.id);
        else await supabaseAdmin.from("leads").insert({ user_id: ctx.userId, contact_id: contact.contact_id, stage_id: stageId });
      }
      return null;
    }
    default: return null;
  }
}
