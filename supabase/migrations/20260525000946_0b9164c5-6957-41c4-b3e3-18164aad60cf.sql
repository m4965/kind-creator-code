-- Sessions table
create table public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  provider text not null default 'evolution' check (provider in ('evolution','wppjs')),
  url text not null default '',
  instance text not null default '',
  api_key text not null default '',
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'disconnected',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;

create policy "own sessions all" on public.whatsapp_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_sessions_updated_at
  before update on public.whatsapp_sessions
  for each row execute function public.set_updated_at();

-- Link flows to sessions
alter table public.flows add column if not exists session_id uuid;
create index if not exists idx_flows_session on public.flows(session_id);

-- Storage bucket for flow media
insert into storage.buckets (id, name, public)
values ('flow-media', 'flow-media', false)
on conflict (id) do nothing;

-- RLS: users only access their own folder (path: <user_id>/...)
create policy "flow-media own read" on storage.objects
  for select using (
    bucket_id = 'flow-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "flow-media own insert" on storage.objects
  for insert with check (
    bucket_id = 'flow-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "flow-media own update" on storage.objects
  for update using (
    bucket_id = 'flow-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "flow-media own delete" on storage.objects
  for delete using (
    bucket_id = 'flow-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );