import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFunnel, moveLead } from "@/lib/funnel.functions";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funnel")({
  component: Funnel,
});

function Funnel() {
  const qc = useQueryClient();
  const list = useServerFn(listFunnel);
  const move = useServerFn(moveLead);
  const { data } = useQuery({ queryKey: ["funnel"], queryFn: () => list() });
  const stages = data?.stages ?? [];
  const leads = data?.leads ?? [];

  async function onDrop(e: React.DragEvent, stageId: string) {
    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId) return;
    await move({ data: { leadId, stageId } });
    qc.invalidateQueries({ queryKey: ["funnel"] });
    toast.success("Movido");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Funil</h1>
      <p className="text-sm text-muted-foreground">Arraste leads entre as etapas. IDs das etapas são exibidos para uso em fluxos.</p>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {stages.map((s: any) => (
          <div
            key={s.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, s.id)}
            className="min-w-[260px] flex-shrink-0 rounded-lg border border-border bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <h2 className="font-medium">{s.name}</h2>
            </div>
            <code className="text-[10px] text-muted-foreground">{s.id}</code>
            <div className="mt-3 space-y-2">
              {leads.filter((l: any) => l.stage_id === s.id).map((l: any) => (
                <Card
                  key={l.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                  className="cursor-move p-3"
                >
                  <div className="text-sm font-medium">{l.contact?.name ?? l.contact?.phone}</div>
                  <div className="text-xs text-muted-foreground">{l.contact?.phone}</div>
                  {Number(l.value) > 0 && (
                    <div className="mt-1 text-xs text-emerald-500">R$ {Number(l.value).toFixed(2)}</div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
