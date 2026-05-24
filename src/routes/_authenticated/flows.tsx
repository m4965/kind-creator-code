import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFlows, saveFlow, deleteFlow } from "@/lib/flows.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/flows")({
  component: Flows,
});

function Flows() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fn = useServerFn(listFlows);
  const save = useServerFn(saveFlow);
  const del = useServerFn(deleteFlow);
  const { data } = useQuery({ queryKey: ["flows"], queryFn: () => fn() });

  async function create() {
    const res = await save({
      data: {
        name: "Novo fluxo",
        description: "",
        active: false,
        trigger_type: "keyword",
        trigger_keywords: [],
        nodes: [],
        edges: [],
      },
    });
    navigate({ to: "/flows/$id", params: { id: res.id } });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fluxos</h1>
          <p className="text-sm text-muted-foreground">Automações por palavra-chave.</p>
        </div>
        <Button onClick={create}>
          <Plus className="mr-1 h-4 w-4" /> Novo fluxo
        </Button>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((f: any) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between">
              <Link to="/flows/$id" params={{ id: f.id }} className="font-medium hover:underline">
                {f.name}
              </Link>
              <div className="flex items-center gap-2">
                <Switch
                  checked={f.active}
                  onCheckedChange={async (v) => {
                    await save({ data: { ...f, active: v } });
                    qc.invalidateQueries({ queryKey: ["flows"] });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("Excluir fluxo?")) return;
                    await del({ data: { id: f.id } });
                    qc.invalidateQueries({ queryKey: ["flows"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Gatilho: {f.trigger_type === "any" ? "qualquer mensagem" : (f.trigger_keywords ?? []).join(", ") || "—"}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
