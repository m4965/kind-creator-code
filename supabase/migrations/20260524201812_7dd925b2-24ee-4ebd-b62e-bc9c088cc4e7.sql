
-- =========================
-- ENUMS
-- =========================
create type public.app_role as enum ('admin', 'user');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.message_type as enum ('text', 'image', 'audio', 'video', 'document');
create type public.payment_status as enum ('pending', 'confirmed', 'rejected');

-- =========================
-- profiles
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- =========================
-- user_roles
-- =========================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "own roles select" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- =========================
-- settings
-- =========================
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  evolution_url text default '',
  evolution_instance text default '',
  evolution_key text default '',
  groq_key text default '',
  groq_model text default 'llama-3.3-70b-versatile',
  groq_audio_model text default 'whisper-large-v3-turbo',
  groq_vision_model text default 'meta-llama/llama-4-scout-17b-16e-instruct',
  system_prompt text default 'Você é um assistente cordial e objetivo de atendimento via WhatsApp. Responda em português, curto e útil.',
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "own settings all" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- contacts
-- =========================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  name text,
  avatar_url text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, phone)
);
alter table public.contacts enable row level security;
create policy "own contacts all" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.contacts(user_id, phone);

-- =========================
-- conversations
-- =========================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  ai_enabled boolean not null default true,
  unread int not null default 0,
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, contact_id)
);
alter table public.conversations enable row level security;
create policy "own conversations all" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.conversations(user_id, last_message_at desc);

-- =========================
-- messages
-- =========================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  type public.message_type not null default 'text',
  content text,
  media_url text,
  transcript text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own messages all" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.messages(conversation_id, created_at);

-- bump conversation on new message
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message = coalesce(new.transcript, new.content, '[' || new.type::text || ']'),
        last_message_at = new.created_at,
        unread = case when new.role = 'user' then unread + 1 else unread end
  where id = new.conversation_id;
  return new;
end;
$$;
create trigger trg_bump_conversation
after insert on public.messages
for each row execute function public.bump_conversation();

-- =========================
-- flows
-- =========================
create table public.flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  active boolean not null default true,
  trigger_type text not null default 'keyword', -- keyword | any
  trigger_keywords text[] not null default '{}',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.flows enable row level security;
create policy "own flows all" on public.flows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- quick_replies
-- =========================
create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shortcut text not null,
  content text not null,
  media_url text,
  media_type public.message_type default 'text',
  created_at timestamptz not null default now(),
  unique (user_id, shortcut)
);
alter table public.quick_replies enable row level security;
create policy "own qr all" on public.quick_replies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- funnel_stages
-- =========================
create table public.funnel_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  "order" int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.funnel_stages enable row level security;
create policy "own stages all" on public.funnel_stages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- leads
-- =========================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  stage_id uuid references public.funnel_stages(id) on delete set null,
  value numeric default 0,
  notes text default '',
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "own leads all" on public.leads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- payments
-- =========================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  status public.payment_status not null default 'pending',
  amount numeric,
  extracted jsonb not null default '{}'::jsonb,
  media_url text,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "own payments all" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================
-- updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();
create trigger trg_flows_updated before update on public.flows for each row execute function public.set_updated_at();
create trigger trg_leads_updated before update on public.leads for each row execute function public.set_updated_at();

-- =========================
-- auto-create profile + settings on signup
-- =========================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));

  insert into public.settings (user_id) values (new.id);

  insert into public.user_roles (user_id, role) values (new.id, 'user');

  -- default funnel stages
  insert into public.funnel_stages (user_id, name, color, "order") values
    (new.id, 'Novo', '#6366f1', 0),
    (new.id, 'Em conversa', '#f59e0b', 1),
    (new.id, 'Negociação', '#8b5cf6', 2),
    (new.id, 'Fechado', '#10b981', 3),
    (new.id, 'Perdido', '#ef4444', 4);

  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- realtime
-- =========================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.leads;
