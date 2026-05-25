// Unified WhatsApp sender — supports Evolution API and whatsapp-js servers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WaSession = {
  id: string;
  user_id: string;
  provider: "evolution" | "wppjs";
  url: string;
  instance: string;
  api_key: string;
};

const trim = (u: string) => u.replace(/\/+$/, "");

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("wa send", url, res.status, await res.text().catch(() => ""));
  return res.ok;
}

export async function waSendText(s: WaSession, to: string, text: string) {
  if (!s.url || !s.instance) return;
  if (s.provider === "wppjs") {
    return post(`${trim(s.url)}/client/sendMessage/${s.instance}`,
      { "x-api-key": s.api_key },
      { chatId: `${to}@c.us`, contentType: "string", content: text });
  }
  return post(`${trim(s.url)}/message/sendText/${s.instance}`,
    { apikey: s.api_key }, { number: to, text });
}

export async function waSendMedia(
  s: WaSession, to: string,
  kind: "image" | "video" | "document" | "audio",
  url: string, caption?: string,
) {
  if (!s.url || !s.instance) return;
  if (s.provider === "wppjs") {
    return post(`${trim(s.url)}/client/sendMessage/${s.instance}`,
      { "x-api-key": s.api_key },
      { chatId: `${to}@c.us`, contentType: "MessageMedia",
        content: { url }, options: { caption } });
  }
  if (kind === "audio") {
    return post(`${trim(s.url)}/message/sendWhatsAppAudio/${s.instance}`,
      { apikey: s.api_key }, { number: to, audio: url });
  }
  return post(`${trim(s.url)}/message/sendMedia/${s.instance}`,
    { apikey: s.api_key }, { number: to, mediatype: kind, media: url, caption });
}

export async function waDownload(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return res.arrayBuffer();
}

// Resolve a media reference (either a plain URL or a storage path) into a fetchable URL.
export async function resolveMedia(ref: string | { path?: string; url?: string }): Promise<string | null> {
  if (!ref) return null;
  if (typeof ref === "string") {
    if (!ref) return null;
    if (/^https?:\/\//i.test(ref)) return ref;
    // treat as storage path
    const { data } = await supabaseAdmin.storage.from("flow-media").createSignedUrl(ref, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? null;
  }
  if (ref.url) return ref.url;
  if (ref.path) {
    const { data } = await supabaseAdmin.storage.from("flow-media").createSignedUrl(ref.path, 60 * 60 * 24 * 7);
    return data?.signedUrl ?? null;
  }
  return null;
}
