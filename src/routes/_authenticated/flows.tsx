import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Trash2, Zap, MessageSquare, Image as ImgIcon, Mic, Video, Brain, CreditCard, GitBranch, Filter,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/flows")({
  component: FlowsPage,
});

const NODE_TYPES_LIST = [
  { key: "trigger", label: "Gatilho", icon: Zap, color: "bg-amber-500", defaultData: {} },
  { key: "sendText", label: "Enviar texto", icon: MessageSquare, color: "bg-blue-500", defaultData: { text: "Olá!" } },
  { key: "sendImage", label: "Enviar imagem", icon: ImgIcon, color: "bg-pink-500", defaultData: { url: "", caption: "" } },
  { key: "sendAudio", label: "Enviar áudio", icon: Mic, color: "bg-purple-500", defaultData: { url: "" } },
  { key: "sendVideo", label: "Enviar vídeo", icon: Video, color: "bg-red-500", defaultData: { url: "", caption: "" } },
  { key: "ai", label: "Resposta IA", icon: Brain, color: "bg-emerald-500", defaultData: { prompt: "" } },
  { key: "payment", label: "Confirmar pagamento", icon: CreditCard, color: "bg-green-600", defaultData: {} },
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
        {data.text || data.prompt || data.contains || data.caption || "—"}
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
      { id: "trigger_1", type: "trigger", position: { x: 40, y: 120 }, data: {} },
      { id: "sendText_1", type: "sendText", position: { x: 290, y: 60 }, data: { text: "Olá! 👋 Como posso te ajudar hoje?" } },
      { id: "ai_1", type: "ai", position: { x: 290, y: 220 }, data: { prompt: "Você é um atendente cordial. Responda em português, curto e útil." } },
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

  useEffect(() => {
    if (!selectedId && flows && flows.length > 0) setSelectedId((flows[0] as any).id);
  }, [flows, selectedId]);

  async function createFlow() {
    const example = buildExampleFlow();
    const res = await saveFn({
      data: {
        name: "Novo fluxo",
        description: "",
        active: false,
        trigger_type: "keyword",
        trigger_keywords: ["oi", "olá", "ola"],
        nodes: example.nodes as any,
        edges: example.edges as any,
      },
    });
    await qc.invalidateQueries({ queryKey: ["flows"] });
    setSelectedId(res.id);
    toast.success("Fluxo criado com exemplo pronto");
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left: list */}
      <aside className="flex w-64 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="font-semibold">Fluxos</div>
          <Button size="sm" onClick={createFlow}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Novo
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {(flows ?? []).length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">Crie seu primeiro fluxo.</p>
          )}
          {(flows ?? []).map((f: any) => (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              className={`group flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                selectedId === f.id ? "bg-muted" : ""
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span className={`h-2 w-2 rounded-full ${f.active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <span className="truncate">{f.name}</span>
              </span>
              <Trash2
                className="hidden h-3.5 w-3.5 text-muted-foreground hover:text-destructive group-hover:block"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm("Excluir fluxo?")) return;
                  await delFn({ data: { id: f.id } });
                  if (selectedId === f.id) setSelectedId(null);
                  qc.invalidateQueries({ queryKey: ["flows"] });
                }}
              />
            </button>
          ))}
        </div>
      </aside>

      {/* Right: editor */}
      <div className="flex flex-1 flex-col">
        {selectedId ? (
          <FlowEditor key={selectedId} id={selectedId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie um fluxo.
          </div>
        )}
      </div>
    </div>
  );
}

function FlowEditor({ id }: { id: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getFlow);
  const saveFn = useServerFn(saveFlow);
  const { data: flow } = useQuery({ queryKey: ["flow", id], queryFn: () => getFn({ data: { id } }) });

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [triggerType, setTriggerType] = useState<"keyword" | "any">("keyword");
  const [keywords, setKeywords] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<Node | null>(null);

  useEffect(() => {
    if (!flow) return;
    setName(flow.name);
    setActive(flow.active);
    setTriggerType((flow.trigger_type as any) ?? "keyword");
    setKeywords((flow.trigger_keywords ?? []).join(", "));
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
      {
        id: nid,
        type,
        position: { x: 200 + nds.length * 30, y: 120 + nds.length * 30 },
        data: { ...meta.defaultData },
      },
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
        id,
        name,
        description: "",
        active,
        trigger_type: triggerType,
        trigger_keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        nodes: nodes as any,
        edges: edges as any,
      },
    });
    await qc.invalidateQueries({ queryKey: ["flows"] });
    toast.success("Fluxo salvo");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
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
        <div className="ml-auto flex items-center gap-3">
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
        <div className="flex-1">
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
          >
            <Background />
            <Controls />
            <MiniMap />
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
    </>
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
    case "sendVideo":
      return (
        <div className="space-y-2">
          <Label>URL da mídia</Label>
          <Input value={d.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} />
          <Label>Legenda</Label>
          <Input value={d.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
        </div>
      );
    case "sendAudio":
      return (
        <div className="space-y-2">
          <Label>URL do áudio</Label>
          <Input value={d.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} />
        </div>
      );
    case "ai":
      return (
        <div className="space-y-2">
          <Label>Prompt da IA (vazio = usa o padrão das Configurações)</Label>
          <Textarea value={d.prompt ?? ""} onChange={(e) => onChange({ prompt: e.target.value })} rows={6} />
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
        <p className="text-xs text-muted-foreground">
          Quando o contato enviar uma imagem/PDF, a IA analisa o comprovante. Saída verde = aprovado, vermelha = rejeitado.
        </p>
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
