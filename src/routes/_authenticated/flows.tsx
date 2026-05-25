import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { listFlows, getFlow, saveFlow, deleteFlow } from "@/lib/flows.functions";
import { getSettings, saveSettings } from "@/lib/settings.functions";
import { listSessions } from "@/lib/sessions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Plus, Trash2, Zap, MessageSquare, Image as ImgIcon, Mic, Video, Brain, CreditCard, GitBranch, Filter,
  Search, Edit3, ArrowLeft, Bot, Star, Upload, X, FileText, Link as LinkIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/flows")({
  component: FlowsPage,
});

const NODE_TYPES_LIST = [
  { key: "trigger", label: "Gatilho", icon: Zap, color: "bg-amber-500", defaultData: {} },
  { key: "sendText", label: "Enviar texto", icon: MessageSquare, color: "bg-blue-500", defaultData: { text: "Olá!" } },
  { key: "sendImage", label: "Enviar imagem", icon: ImgIcon, color: "bg-pink-500", defaultData: { items: [], caption: "" } },
  { key: "sendAudio", label: "Enviar áudio", icon: Mic, color: "bg-purple-500", defaultData: { items: [] } },
  { key: "sendVideo", label: "Enviar vídeo", icon: Video, color: "bg-red-500", defaultData: { items: [], caption: "" } },
  { key: "ai", label: "Resposta IA", icon: Brain, color: "bg-emerald-500", defaultData: { prompt: "" } },
  { key: "payment", label: "Confirmar pagamento", icon: CreditCard, color: "bg-green-600", defaultData: { files: [], links: [], success_message: "" } },
  { key: "condition", label: "Condição", icon: GitBranch, color: "bg-yellow-600", defaultData: { contains: "" } },
  { key: "moveFunnel", label: "Mover no funil", icon: Filter, color: "bg-indigo-500", defaultData: { stage_id: "" } },
] as const;

function NodeShell({ data, type, selected }: any) {
  const meta = NODE_TYPES_LIST.find((n) => n.key === type)!;
  const Icon = meta.icon;
  const hasInput = type !== "trigger";
  return (
    <div className={`min-w-[180px] rounded-lg border-2 bg-card text-card-foreground shadow ${selected ? "border-primary" : "border-border"}`}>
      {hasInput && <Handle type="target" position={Position.Left} />}
      <div className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-white ${meta.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{meta.label}</span>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2">
        {data.text || data.prompt || data.contains || data.caption || data.pdf_url || data.link || "—"}
      </div>
      {type === "payment" ? (
        <>
          <Handle id="approved" type="source" position={Position.Right} style={{ top: "35%", background: "#16a34a" }} />
          <Handle id="rejected" type="source" position={Position.Right} style={{ top: "75%", background: "#dc2626" }} />
        </>
      ) : type === "condition" ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: "35%", background: "#16a34a" }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: "75%", background: "#dc2626" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

const nodeTypes = Object.fromEntries(NODE_TYPES_LIST.map((n) => [n.key, NodeShell]));

function buildExampleFlow() {
  return {
    nodes: [
      { id: "trigger_1", type: "trigger", position: { x: 40, y: 160 }, data: {} },
      { id: "sendText_1", type: "sendText", position: { x: 290, y: 60 }, data: { text: "Olá! 👋 Sou o atendente virtual. Como posso te ajudar hoje?" } },
      { id: "ai_1", type: "ai", position: { x: 290, y: 260 }, data: { prompt: "" } },
    ],
    edges: [
      { id: "e1", source: "trigger_1", target: "sendText_1", animated: true },
      { id: "e2", source: "sendText_1", target: "ai_1", animated: true },
    ],
  };
}

function FlowsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFlows);
  const saveFn = useServerFn(saveFlow);
  const delFn = useServerFn(deleteFlow);
  const { data: flows } = useQuery({ queryKey: ["flows"], queryFn: () => listFn() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function createFlow() {
    const example = buildExampleFlow();
    const res = await saveFn({
      data: {
        name: "Novo fluxo de atendimento",
        description: "",
        active: false,
        trigger_type: "any",
        trigger_keywords: [],
        nodes: example.nodes as any,
        edges: example.edges as any,
      },
    });
    await qc.invalidateQueries({ queryKey: ["flows"] });
    setSelectedId(res.id);
    toast.success("Fluxo criado com exemplo pronto");
  }

  if (selectedId) {
    return <FlowEditor key={selectedId} id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const filtered = (flows ?? []).filter((f: any) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fluxos</h1>
          <p className="text-sm text-muted-foreground">
            {(flows ?? []).length} {(flows ?? []).length === 1 ? "fluxo criado" : "fluxos criados"}
          </p>
        </div>
        <Button onClick={createFlow}>
          <Plus className="mr-1 h-4 w-4" /> Novo fluxo
        </Button>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar fluxos..."
          className="pl-9"
        />
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Star className="h-3.5 w-3.5 text-amber-500" />
        MEUS FLUXOS
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-3 p-10 text-center text-sm text-muted-foreground">
          Nenhum fluxo ainda. Clique em <strong>Novo fluxo</strong> para começar com um exemplo pronto.
        </Card>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f: any) => (
            <FlowCard
              key={f.id}
              flow={f}
              onEdit={() => setSelectedId(f.id)}
              onDelete={async () => {
                if (!confirm("Excluir fluxo?")) return;
                await delFn({ data: { id: f.id } });
                qc.invalidateQueries({ queryKey: ["flows"] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({ flow, onEdit, onDelete }: { flow: any; onEdit: () => void; onDelete: () => void }) {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes.length : 0;
  const edges = Array.isArray(flow.edges) ? flow.edges.length : 0;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{flow.name}</div>
              {!flow.active && <Badge variant="destructive" className="text-[10px]">INATIVO</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              {flow.trigger_type === "any" ? "Qualquer mensagem" : (flow.trigger_keywords ?? []).join(", ") || "Sem gatilho"}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <Stat label="Blocos" value={nodes} />
        <Stat label="Conexões" value={edges} />
        <Stat label="Ativo" value={flow.active ? "Sim" : "Não"} />
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button className="flex-1 bg-amber-500 text-black hover:bg-amber-400" onClick={onEdit}>
          <Edit3 className="mr-1 h-4 w-4" /> Editar
        </Button>
        <Button variant="destructive" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function FlowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getFlow);
  const saveFn = useServerFn(saveFlow);
  const listSessFn = useServerFn(listSessions);
  const { data: flow } = useQuery({ queryKey: ["flow", id], queryFn: () => getFn({ data: { id } }) });
  const { data: sessions } = useQuery({ queryKey: ["sessions"], queryFn: () => listSessFn() });

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [triggerType, setTriggerType] = useState<"keyword" | "any">("keyword");
  const [keywords, setKeywords] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    if (!flow) return;
    setName(flow.name);
    setActive(flow.active);
    setTriggerType((flow.trigger_type as any) ?? "keyword");
    setKeywords((flow.trigger_keywords ?? []).join(", "));
    setSessionId((flow as any).session_id ?? null);
    setNodes(((flow.nodes as unknown) as Node[]) ?? []);
    setEdges(((flow.edges as unknown) as Edge[]) ?? []);
    setSelected(null);
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  function addNode(type: string) {
    const meta = NODE_TYPES_LIST.find((n) => n.key === type)!;
    const nid = `${type}_${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      { id: nid, type, position: { x: 200 + nds.length * 30, y: 120 + nds.length * 30 },
        data: JSON.parse(JSON.stringify(meta.defaultData)) },
    ]);
  }

  function updateSelected(patch: Record<string, any>) {
    if (!selected) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
    setSelected((s) => (s ? { ...s, data: { ...s.data, ...patch } } : s));
  }

  async function save() {
    await saveFn({
      data: {
        id, name, description: "", active,
        trigger_type: triggerType,
        trigger_keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        session_id: sessionId,
        nodes: nodes as any,
        edges: edges as any,
      },
    });
    await qc.invalidateQueries({ queryKey: ["flows"] });
    toast.success("Fluxo salvo");
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Select value={triggerType} onValueChange={(v) => setTriggerType(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">Por palavra-chave</SelectItem>
            <SelectItem value="any">Qualquer mensagem</SelectItem>
          </SelectContent>
        </Select>
        {triggerType === "keyword" && (
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="palavras separadas por vírgula"
            className="max-w-sm"
          />
        )}
        <Select value={sessionId ?? "none"} onValueChange={(v) => setSessionId(v === "none" ? null : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Sessão WhatsApp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Todas as sessões</SelectItem>
            {(sessions ?? []).map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <AgentSheet />
          <Label className="flex items-center gap-2 text-sm">
            Ativo <Switch checked={active} onCheckedChange={setActive} />
          </Label>
          <Button onClick={save}>Salvar</Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 space-y-1 overflow-y-auto border-r border-border p-2">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Adicionar nó</div>
          {NODE_TYPES_LIST.map((n) => (
            <button
              key={n.key}
              onClick={() => addNode(n.key)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded text-white ${n.color}`}>
                <n.icon className="h-3.5 w-3.5" />
              </span>
              {n.label}
            </button>
          ))}
        </div>
        <div className="flex-1 bg-muted/20">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelected(n)}
            onPaneClick={() => setSelected(null)}
            fitView
            colorMode="dark"
          >
            <Background />
            <Controls />
            <MiniMap
              pannable
              zoomable
              style={{ background: "#0b0b0f" }}
              maskColor="rgba(0,0,0,0.7)"
              nodeColor="#f59e0b"
              nodeStrokeColor="#1f2937"
            />
          </ReactFlow>
        </div>
        {selected && (
          <div className="w-80 space-y-3 overflow-y-auto border-l border-border p-4">
            <div className="text-sm font-semibold">
              {NODE_TYPES_LIST.find((n) => n.key === selected.type)?.label}
            </div>
            <NodeEditor node={selected} onChange={updateSelected} />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selected.id));
                setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id));
                setSelected(null);
              }}
            >
              Remover nó
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentSheet() {
  const getFn = useServerFn(getSettings);
  const saveFn = useServerFn(saveSettings);
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => getFn() });
  const [prompt, setPrompt] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (settings) setPrompt((settings as any).system_prompt ?? "");
  }, [settings]);

  async function save() {
    await saveFn({
      data: {
        evolution_url: (settings as any)?.evolution_url ?? "",
        evolution_instance: (settings as any)?.evolution_instance ?? "",
        groq_model: (settings as any)?.groq_model ?? "llama-3.3-70b-versatile",
        groq_audio_model: (settings as any)?.groq_audio_model ?? "whisper-large-v3-turbo",
        groq_vision_model: (settings as any)?.groq_vision_model ?? "meta-llama/llama-4-scout-17b-16e-instruct",
        system_prompt: prompt,
      },
    });
    await qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Agente atualizado");
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Bot className="mr-1 h-4 w-4" /> Agente IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Instruções do agente IA</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Este prompt é usado por todos os nós de IA que não tiverem instrução própria.
            Descreva seu produto, tom de voz, regras de venda, perguntas frequentes e o que a IA
            deve ou não responder. Quanto mais específico, melhor.
          </p>
          <Label>Prompt principal do agente</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={20}
            placeholder={`Você é o atendente virtual da [SUA EMPRESA].

PRODUTO: descreva o que vende, preço, formas de pagamento.
TOM: cordial, objetivo, em português, mensagens curtas.
REGRAS:
- Nunca invente preços.
- Se o cliente pedir desconto, ofereça no máximo 10%.
- Se não souber algo, peça para aguardar e diga que um humano vai responder.
- Após a venda, envie o link/PDF do produto.`}
          />
          <Button onClick={save} className="w-full">Salvar agente</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NodeEditor({ node, onChange }: { node: Node; onChange: (p: any) => void }) {
  const d = node.data as any;
  switch (node.type) {
    case "trigger":
      return <p className="text-xs text-muted-foreground">Disparado quando uma mensagem bate com o gatilho do fluxo.</p>;
    case "sendText":
      return (
        <div className="space-y-2">
          <Label>Texto</Label>
          <Textarea value={d.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} rows={5} />
        </div>
      );
    case "sendImage":
      return (
        <div className="space-y-3">
          <MediaUploader accept="image/*" items={d.items ?? []} onChange={(items) => onChange({ items })} label="Imagens" />
          <Label>Legenda</Label>
          <Input value={d.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
        </div>
      );
    case "sendVideo":
      return (
        <div className="space-y-3">
          <MediaUploader accept="video/*" items={d.items ?? []} onChange={(items) => onChange({ items })} label="Vídeos" />
          <Label>Legenda</Label>
          <Input value={d.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
        </div>
      );
    case "sendAudio":
      return (
        <div className="space-y-3">
          <MediaUploader accept="audio/*" items={d.items ?? []} onChange={(items) => onChange({ items })} label="Áudios" />
        </div>
      );
    case "ai":
      return (
        <div className="space-y-2">
          <Label>Prompt da IA (vazio = usa o Agente IA)</Label>
          <Textarea
            value={d.prompt ?? ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
            rows={8}
            placeholder="Ex.: Responda dúvidas sobre o produto X. Se o cliente quiser comprar, peça nome e CEP."
          />
          <p className="text-xs text-muted-foreground">
            Dica: deixe vazio para herdar o prompt principal do Agente IA (botão no topo).
          </p>
        </div>
      );
    case "condition":
      return (
        <div className="space-y-2">
          <Label>Contém o texto</Label>
          <Input value={d.contains ?? ""} onChange={(e) => onChange({ contains: e.target.value })} />
          <p className="text-xs text-muted-foreground">Saída verde = verdadeiro, vermelha = falso.</p>
        </div>
      );
    case "payment":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Quando o contato enviar comprovante, a IA analisa. Se aprovado, envia os arquivos e links abaixo (pode ter vários).
          </p>
          <Label>Mensagem ao aprovar</Label>
          <Textarea
            value={d.success_message ?? ""}
            onChange={(e) => onChange({ success_message: e.target.value })}
            rows={3}
            placeholder="Pagamento confirmado! Segue o acesso ao seu produto:"
          />
          <MediaUploader
            accept=".pdf,application/pdf,image/*,video/*,audio/*,.zip"
            items={d.files ?? []}
            onChange={(files) => onChange({ files })}
            label="Arquivos (PDFs, mídias)"
          />
          <LinkList links={d.links ?? []} onChange={(links) => onChange({ links })} />
        </div>
      );
    case "moveFunnel":
      return (
        <div className="space-y-2">
          <Label>ID da etapa do funil</Label>
          <Input value={d.stage_id ?? ""} onChange={(e) => onChange({ stage_id: e.target.value })} />
          <p className="text-xs text-muted-foreground">Pegue o ID em Funil → editar etapa.</p>
        </div>
      );
    default:
      return null;
  }
}
