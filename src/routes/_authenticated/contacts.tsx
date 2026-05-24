import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listContacts } from "@/lib/contacts.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: Contacts,
});

function Contacts() {
  const fn = useServerFn(listContacts);
  const { data } = useQuery({ queryKey: ["contacts"], queryFn: () => fn() });
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Contatos</h1>
      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.name ?? "—"}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{(c.tags ?? []).join(", ") || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
