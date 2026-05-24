import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [conv, msg, contacts, payments] = await Promise.all([
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("payments")
        .select("id,amount", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "confirmed"),
    ]);
    const totalAmount = (payments.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return {
      conversations: conv.count ?? 0,
      messages: msg.count ?? 0,
      contacts: contacts.count ?? 0,
      paymentsCount: payments.count ?? 0,
      paymentsTotal: totalAmount,
    };
  });
