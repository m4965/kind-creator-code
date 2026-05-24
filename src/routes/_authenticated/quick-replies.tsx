import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listQuickReplies, upsertQuickReply, deleteQuickReply } from "@/lib/quick-replies.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quick-replies")({
  component: QuickReplies,
});

function QuickReplies() {
  const qc = useQueryClient();
  const list = useServerFn(listQuickReplies);
  const save = useServerFn(upsertQuickReply);
  const del = useServerFn(deleteQuickReply);
  const { data } = useQuery({ queryKey: ["qr"], queryFn: () => list() });
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");

  async function add() {
    try {
      await save({ data: { shortcut, content, media_type: "text" } });
      setShortcut("");
      setContent("");
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["qr"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Respostas rápidas</h1>
      <p className="text-sm text-muted-foreground">Atalhos para reutilizar mensagens no inbox.</p>
      <Card className="mt-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr_auto] md:items-end">
          <div className="space-y-1">
            <Label>Atalho</Label>
            <Input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="ola" />
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} />
          </div>
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
        </div>
      </Card>
      <div className="mt-6 space-y-2">
        {(data ?? []).map((q: any) => (
          <Card key={q.id} className="flex items-start justify-between p-3">
            <div>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/{q.shortcut}</code>
              <div className="mt-1 whitespace-pre-wrap text-sm">{q.content}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await del({ data: { id: q.id } });
                qc.invalidateQueries({ queryKey: ["qr"] });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
