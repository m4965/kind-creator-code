type EvoSettings = {
  evolution_url: string;
  evolution_instance: string;
  evolution_key: string;
};

function trimUrl(u: string) {
  return u.replace(/\/+$/, "");
}

export async function evoSendText(s: EvoSettings, to: string, text: string) {
  if (!s.evolution_url || !s.evolution_instance) return;
  const res = await fetch(`${trimUrl(s.evolution_url)}/message/sendText/${s.evolution_instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: s.evolution_key },
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) console.error("evoSendText", res.status, await res.text());
}

export async function evoSendMedia(
  s: EvoSettings,
  to: string,
  mediatype: "image" | "video" | "document",
  url: string,
  caption?: string,
) {
  if (!s.evolution_url || !s.evolution_instance) return;
  const res = await fetch(`${trimUrl(s.evolution_url)}/message/sendMedia/${s.evolution_instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: s.evolution_key },
    body: JSON.stringify({ number: to, mediatype, media: url, caption }),
  });
  if (!res.ok) console.error("evoSendMedia", res.status, await res.text());
}

export async function evoSendAudio(s: EvoSettings, to: string, url: string) {
  if (!s.evolution_url || !s.evolution_instance) return;
  const res = await fetch(
    `${trimUrl(s.evolution_url)}/message/sendWhatsAppAudio/${s.evolution_instance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: s.evolution_key },
      body: JSON.stringify({ number: to, audio: url }),
    },
  );
  if (!res.ok) console.error("evoSendAudio", res.status, await res.text());
}

export async function downloadMedia(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return res.arrayBuffer();
}
