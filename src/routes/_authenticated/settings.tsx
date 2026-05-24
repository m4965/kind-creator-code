import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, saveSettings } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const get = useServerFn(getSettings);
  const save = useServerFn(saveSettings);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => get() });

  const [f, setF] = useState({
    evolution_url: "",
    evolution_instance: "",
    evolution_key: "",
    groq_key: "",
    groq_model: "llama-3.3-70b-versatile",
    groq_audio_model: "whisper-large-v3-turbo",
    groq_vision_model: "meta-llama/llama-4-scout-17b-16e-instruct",
    system_prompt: "",
  });

  useEffect(() => {
    if (data) setF((p) => ({
      ...p,
      evolution_url: (data as any).evolution_url ?? "",
      evolution_instance: (data as any).evolution_instance ?? "",
      evolution_key: "",
      groq_key: "",
      groq_model: (data as any).groq_model ?? p.groq_model,
      groq_audio_model: (data as any).groq_audio_model ?? p.groq_audio_model,
      groq_vision_model: (data as any).groq_vision_model ?? p.groq_vision_model,
      system_prompt: (data as any).system_prompt ?? "",
    }));
  }, [data]);

  const hasEvoKey = Boolean((data as any)?.has_evolution_key);
  const hasGroqKey = Boolean((data as any)?.has_groq_key);


  const webhookUrl =
    typeof window !== "undefined" && data
      ? `${window.location.origin}/api/public/webhook/evolution?user_id=${(data as any).user_id}`
      : "";

  async function onSave() {
    await save({ data: f });
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Conecte WhatsApp (Evolution API) e IA (Groq).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook do WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Cole esta URL no webhook da Evolution (evento messages.upsert).</p>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast.success("Copiado");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolution API</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>URL base</Label>
            <Input value={f.evolution_url} onChange={(e) => setF({ ...f, evolution_url: e.target.value })} placeholder="https://api.suaevolution.com" />
          </div>
          <div className="space-y-1">
            <Label>Nome da instância</Label>
            <Input value={f.evolution_instance} onChange={(e) => setF({ ...f, evolution_instance: e.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>API key</Label>
            <Input type="password" value={f.evolution_key} onChange={(e) => setF({ ...f, evolution_key: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Groq IA</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>API key</Label>
            <Input type="password" value={f.groq_key} onChange={(e) => setF({ ...f, groq_key: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Modelo de texto</Label>
            <Input value={f.groq_model} onChange={(e) => setF({ ...f, groq_model: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Modelo de áudio</Label>
            <Input value={f.groq_audio_model} onChange={(e) => setF({ ...f, groq_audio_model: e.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Modelo de visão (comprovantes)</Label>
            <Input value={f.groq_vision_model} onChange={(e) => setF({ ...f, groq_vision_model: e.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>System prompt padrão</Label>
            <Textarea rows={5} value={f.system_prompt} onChange={(e) => setF({ ...f, system_prompt: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSave}>Salvar configurações</Button>
    </div>
  );
}
