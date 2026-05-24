import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConversations, listMessages, toggleAi, sendManualMessage } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: Inbox,
});

function Inbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const msgFn = useServerFn(listMessages);
  const toggleFn = useServerFn(toggleAi);
  const sendFn = useServerFn(sendManualMessage);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");

  const { data: conversations } = useQuery({ queryKey: ["conversations"], queryFn: () => listFn() });
  const { data: messages } = useQuery({
    queryKey: ["messages", selected],
    queryFn: () => msgFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
  });

  useEffect(() => {
    const ch = supabase
      .channel("realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const conv = (conversations ?? []).find((c: any) => c.id === selected);

  async function send() {
    if (!text.trim() || !selected) return;
    await sendFn({ data: { conversationId: selected, text } });
    setText("");
    qc.invalidateQueries({ queryKey: ["messages", selected] });
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <div className="w-80 border-r border-border">
        <div className="border-b border-border p-3 font-semibold">Conversas</div>
        <ScrollArea className="h-[calc(100%-2.75rem)]">
          {(conversations ?? []).map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border p-3 text-left hover:bg-muted/40",
                selected === c.id && "bg-muted/50",
              )}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback>{(c.contact?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="truncate text-sm font-medium">{c.contact?.name ?? c.contact?.phone}</div>
                  {c.unread > 0 && (
                    <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{c.last_message}</div>
              </div>
            </button>
          ))}
          {(!conversations || conversations.length === 0) && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sem conversas ainda. Conecte sua Evolution API e cole a URL do webhook.
            </div>
          )}
        </ScrollArea>
      </div>
      <div className="flex flex-1 flex-col">
        {conv ? (
          <>
            <div className="flex items-center justify-between border-b border-border p-3">
              <div>
                <div className="font-medium">{conv.contact?.name ?? conv.contact?.phone}</div>
                <div className="text-xs text-muted-foreground">{conv.contact?.phone}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>IA</span>
                <Switch
                  checked={conv.ai_enabled}
                  onCheckedChange={async (v) => {
                    await toggleFn({ data: { conversationId: conv.id, enabled: v } });
                    qc.invalidateQueries({ queryKey: ["conversations"] });
                  }}
                />
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="flex flex-col gap-2">
                {(messages ?? []).map((m: any) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-md rounded-lg px-3 py-2 text-sm",
                      m.role === "user"
                        ? "self-start bg-muted"
                        : "self-end bg-primary text-primary-foreground",
                    )}
                  >
                    {m.media_url && m.type === "image" && (
                      <img src={m.media_url} alt="" className="mb-1 max-h-60 rounded" />
                    )}
                    {m.media_url && m.type === "audio" && (
                      <audio controls src={m.media_url} className="mb-1" />
                    )}
                    <div className="whitespace-pre-wrap">{m.transcript || m.content || `[${m.type}]`}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center gap-2 border-t border-border p-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Digite uma mensagem... (/atalho para resposta rápida)"
              />
              <Button onClick={send}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}
