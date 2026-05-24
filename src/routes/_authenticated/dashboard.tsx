import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/contacts.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, CheckCircle2, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data } = useQuery({ queryKey: ["stats"], queryFn: () => fn() });
  const stats = data ?? { conversations: 0, messages: 0, contacts: 0, paymentsCount: 0, paymentsTotal: 0 };

  const cards = [
    { label: "Conversas", value: stats.conversations, icon: Inbox },
    { label: "Mensagens", value: stats.messages, icon: MessageSquare },
    { label: "Contatos", value: stats.contacts, icon: Users },
    {
      label: "Pagamentos confirmados",
      value: `${stats.paymentsCount} • R$ ${stats.paymentsTotal.toFixed(2)}`,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Visão geral do seu atendimento.</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
