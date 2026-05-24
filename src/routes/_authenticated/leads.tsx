import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFunnel } from "@/lib/funnel.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const EXCLUDED = ["novo", "perdido"];

function LeadsPage() {
  const fn = useServerFn(listFunnel);
  const { data } = useQuery({ queryKey: ["funnel"], queryFn: () => fn() });

  const stages = data?.stages ?? [];
  const leads = data?.leads ?? [];
  const stageById = useMemo(() => Object.fromEntries(stages.map((s: any) => [s.id, s])), [stages]);

  const qualified = leads.filter((l: any) => {
    const s = stageById[l.stage_id];
    if (!s) return false;
    return !EXCLUDED.includes(String(s.name).toLowerCase());
  });

  const totalValue = qualified.reduce((sum: number, l: any) => sum + Number(l.value ?? 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads Qualificados</h1>
          <p className="text-sm text-muted-foreground">
            Contatos que avançaram no funil — prontos para fechar.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total em pipeline</div>
          <div className="text-xl font-semibold">
            R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {qualified.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lead qualificado ainda. Mova contatos no funil para começar.
          </Card>
        )}
        {qualified.map((l: any) => {
          const s = stageById[l.stage_id];
          return (
            <Card key={l.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="font-medium">{l.contact?.name ?? l.contact?.phone ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{l.contact?.phone}</div>
                {l.notes && <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{l.notes}</div>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Valor</div>
                  <div className="font-medium">
                    R$ {Number(l.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {s && (
                  <Badge style={{ background: s.color, color: "white" }}>{s.name}</Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
