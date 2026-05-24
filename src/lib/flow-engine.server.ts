import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evoSendText, evoSendMedia, evoSendAudio } from "./evolution.server";
import { groqChat, groqVision } from "./groq.server";

export type FlowNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null };

type Settings = {
  evolution_url: string;
  evolution_instance: string;
  evolution_key: string;
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
  settings: Settings;
};

async function findStart(nodes: FlowNode[]): Promise<FlowNode | undefined> {
  return nodes.find((n) => n.type === "trigger");
}

function nextNodes(current: string, edges: FlowEdge[], handle?: string | null): string[] {
  return edges
    .filter((e) => e.source === current && (handle ? e.sourceHandle === handle : true))
    .map((e) => e.target);
}

async function saveAssistant(ctx: Ctx, content: string, type = "text", mediaUrl?: string) {
  await supabaseAdmin.from("messages").insert({
    user_id: ctx.userId,
    conversation_id: ctx.conversationId,
    role: "assistant",
    type,
    content,
    media_url: mediaUrl,
  });
}

async function getHistory(conversationId: string, limit = 15) {
  const { data } = await supabaseAdmin
    .from("messages")
    .select("role,content,transcript,type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.transcript || m.content || `[${m.type}]`,
    }));
}

export async function runFlow(flow: { nodes: FlowNode[]; edges: FlowEdge[] }, ctx: Ctx) {
  const start = await findStart(flow.nodes);
  if (!start) return;

  const visited = new Set<string>();
  let queue: Array<{ id: string; handle?: string | null }> = nextNodes(start.id, flow.edges).map(
    (id) => ({ id }),
  );

  while (queue.length) {
    const { id } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = flow.nodes.find((n) => n.id === id);
    if (!node) continue;

    let handle: string | null = null;
    try {
      handle = await runNode(node, ctx);
    } catch (e) {
      console.error("node error", node.type, e);
    }

    for (const nxt of nextNodes(id, flow.edges, handle)) queue.push({ id: nxt });
  }
}

async function runNode(node: FlowNode, ctx: Ctx): Promise<string | null> {
  const d = node.data as Record<string, string>;
  switch (node.type) {
    case "sendText": {
      const text = d.text || "";
      await evoSendText(ctx.settings, ctx.contactPhone, text);
      await saveAssistant(ctx, text);
      return null;
    }
    case "sendImage": {
      await evoSendMedia(ctx.settings, ctx.contactPhone, "image", d.url, d.caption);
      await saveAssistant(ctx, d.caption || "", "image", d.url);
      return null;
    }
    case "sendVideo": {
      await evoSendMedia(ctx.settings, ctx.contactPhone, "video", d.url, d.caption);
      await saveAssistant(ctx, d.caption || "", "video", d.url);
      return null;
    }
    case "sendAudio": {
      await evoSendAudio(ctx.settings, ctx.contactPhone, d.url);
      await saveAssistant(ctx, "", "audio", d.url);
      return null;
    }
    case "ai": {
      if (!ctx.settings.groq_key) return null;
      const history = await getHistory(ctx.conversationId);
      const messages = [
        { role: "system", content: d.prompt || ctx.settings.system_prompt },
        ...history,
      ];
      const reply = await groqChat(ctx.settings.groq_key, ctx.settings.groq_model, messages);
      await evoSendText(ctx.settings, ctx.contactPhone, reply);
      await saveAssistant(ctx, reply);
      return null;
    }
    case "condition": {
      const target = (ctx.messageContent || "").toLowerCase();
      const term = (d.contains || "").toLowerCase();
      return term && target.includes(term) ? "true" : "false";
    }
    case "payment": {
      if (!ctx.mediaUrl || !ctx.settings.groq_key) return "rejected";
      const prompt = `Analise esta imagem que pode ser um comprovante de pagamento (PIX, TED, boleto). Responda APENAS em JSON válido com este formato exato:
{"is_receipt": true|false, "approved": true|false, "amount": number|null, "date": "YYYY-MM-DD"|null, "bank": "string"|null, "reason": "explicação curta"}
Considere approved=true somente se: for claramente um comprovante real, tiver valor visível, e parecer legítimo (não rascunho/print de tela suspeito).`;
      let extracted: Record<string, unknown> = {};
      let approved = false;
      try {
        const raw = await groqVision(
          ctx.settings.groq_key,
          ctx.settings.groq_vision_model,
          prompt,
          ctx.mediaUrl,
        );
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) extracted = JSON.parse(m[0]);
        approved = !!extracted.approved && !!extracted.is_receipt;
      } catch (e) {
        console.error("payment vision", e);
      }
      await supabaseAdmin.from("payments").insert({
        user_id: ctx.userId,
        conversation_id: ctx.conversationId,
        message_id: ctx.messageId,
        status: approved ? "confirmed" : "rejected",
        amount: typeof extracted.amount === "number" ? extracted.amount : null,
        extracted,
        media_url: ctx.mediaUrl,
      });
      return approved ? "approved" : "rejected";
    }
    case "moveFunnel": {
      const stageId = d.stage_id;
      if (!stageId) return null;
      const { data: contact } = await supabaseAdmin
        .from("conversations")
        .select("contact_id")
        .eq("id", ctx.conversationId)
        .maybeSingle();
      if (contact?.contact_id) {
        const { data: existing } = await supabaseAdmin
          .from("leads")
          .select("id")
          .eq("contact_id", contact.contact_id)
          .maybeSingle();
        if (existing) {
          await supabaseAdmin.from("leads").update({ stage_id: stageId }).eq("id", existing.id);
        } else {
          await supabaseAdmin
            .from("leads")
            .insert({ user_id: ctx.userId, contact_id: contact.contact_id, stage_id: stageId });
        }
      }
      return null;
    }
    default:
      return null;
  }
}
