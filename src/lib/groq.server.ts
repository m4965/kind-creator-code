const GROQ_BASE = "https://api.groq.com/openai/v1";

export async function groqChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | unknown }>,
  opts: { temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.6 }),
  });
  if (!res.ok) throw new Error(`Groq chat ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function groqTranscribe(
  apiKey: string,
  model: string,
  audio: ArrayBuffer,
  filename = "audio.ogg",
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio]), filename);
  form.append("model", model);
  form.append("response_format", "json");
  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq transcribe ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text: string };
  return data.text ?? "";
}

export async function groqVision(
  apiKey: string,
  model: string,
  prompt: string,
  imageUrl: string,
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`Groq vision ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}
