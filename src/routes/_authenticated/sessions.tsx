import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSessions, saveSession, deleteSession, rotateSessionSecret } from "@/lib/sessions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSessions);
  const saveFn = useServerFn(saveSession);
  const delFn = useServerFn(deleteSession);
  const rotFn = useServerFn(rotateSessionSecret);
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);

  async function newSession() {
    const r = await saveFn({ data: { name: "Novo número", provider: "evolution", url: "", instance: "", api_key: "", active: true } });
    await qc.invalidateQueries({ queryKey: ["sessions"] });
    const fresh = (await listFn()).find((s: any) => s.id === r.id);
    setEditing(fresh);
  }

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[320px_1fr]">
      <aside className="border-r border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Sessões WhatsApp</div>
          <Button size="sm" onClick={newSession}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1">
          {(sessions ?? []).map((s: any) => (
            <button key={s.id}
              onClick={() => setEditing(s)}
              className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted ${editing?.id === s.id ? "bg-muted" : ""}`}>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{s.name}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{s.provider}</div>
              </div>
              {s.active && <Badge variant="secondary" className="text-[10px]">ativo</Badge>}
            </button>
          ))}
          {(sessions ?? []).length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">Nenhuma sessão. Crie a primeira para conectar um WhatsApp.</p>
          )}
        </div>
      </aside>

      <main className="overflow-y-auto p-6">
        {!editing ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Selecione ou crie uma sessão para configurar.
          </Card>
        ) : (
          <SessionEditor
            key={editing.id}
            session={editing}
            onSave={async (patch) => {
              await saveFn({ data: { ...editing, ...patch } });
              await qc.invalidateQueries({ queryKey: ["sessions"] });
              toast.success("Sessão salva");
            }}
            onDelete={async () => {
              if (!confirm("Excluir sessão? Fluxos vinculados ficarão sem destino.")) return;
              await delFn({ data: { id: editing.id } });
              await qc.invalidateQueries({ queryKey: ["sessions"] });
              setEditing(null);
            }}
            onRotate={async () => {
              const r = await rotFn({ data: { id: editing.id } });
              setEditing({ ...editing, webhook_secret: r.secret });
              await qc.invalidateQueries({ queryKey: ["sessions"] });
              toast.success("Novo secret gerado");
            }}
          />
        )}
      </main>
    </div>
  );
}

function SessionEditor({ session, onSave, onDelete, onRotate }: any) {
  const [name, setName] = useState(session.name);
  const [provider, setProvider] = useState<"evolution" | "wppjs">(session.provider);
  const [url, setUrl] = useState(session.url);
  const [instance, setInstance] = useState(session.instance);
  const [apiKey, setApiKey] = useState(session.api_key);
  const [active, setActive] = useState(session.active);
  useEffect(() => {
    setName(session.name); setProvider(session.provider); setUrl(session.url);
    setInstance(session.instance); setApiKey(session.api_key); setActive(session.active);
  }, [session.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/webhook/evolution?session_id=${session.id}&secret=${session.webhook_secret}`;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{session.name}</h1>
        <div className="flex items-center gap-3">
          <Label className="flex items-center gap-2 text-sm">Ativo<Switch checked={active} onCheckedChange={setActive} /></Label>
          <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Provedor</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="evolution">Evolution API</SelectItem>
              <SelectItem value="wppjs">whatsapp-web.js (local)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {provider === "evolution"
              ? "Servidor Evolution API. Compatível com /message/sendText, sendMedia, sendWhatsAppAudio."
              : "Servidor whatsapp-web.js. Use endpoints /client/sendMessage/{instance} com header x-api-key."}
          </p>
        </div>

        <div className="space-y-2">
          <Label>URL do servidor</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://evolution.exemplo.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Instância / Sessão</Label>
            <Input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="minha-instancia" />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••" />
          </div>
        </div>

        <Button onClick={() => onSave({ name, provider, url, instance, api_key: apiKey, active })}>Salvar</Button>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <Label>Webhook (cole no seu servidor de WhatsApp)</Label>
          <Button variant="ghost" size="sm" onClick={onRotate}><RefreshCw className="mr-1 h-3 w-3" /> Rotacionar</Button>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O segredo (<code>?secret=...</code>) valida que apenas seu servidor pode disparar este endpoint.
          Trate como senha. Rotacione se vazar.
        </p>
      </Card>
    </div>
  );
}
