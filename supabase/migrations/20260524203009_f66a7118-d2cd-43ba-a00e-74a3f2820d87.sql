
REVOKE SELECT (groq_key, evolution_key) ON public.settings FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'realtime' AND c.relname = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated postgres_changes only" ON realtime.messages';
    EXECUTE 'CREATE POLICY "authenticated postgres_changes only" ON realtime.messages FOR SELECT TO authenticated USING (extension = ''postgres_changes'')';
  END IF;
END $$;
