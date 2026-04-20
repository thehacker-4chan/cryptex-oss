-- profiles: mirrors auth.users with plan + stripe link
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'paid', 'grace')),
  stripe_customer_id text,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_plan_idx on profiles(plan);

-- Auto-create a profile row when a new auth.user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- byok_keys: ciphertext + KDF params only. Server never sees plaintext.
create table byok_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  provider_id text not null,
  instance_id text,
  label text,
  ciphertext bytea not null,
  iv bytea not null,
  salt bytea not null,
  kdf_iterations int not null default 600000,
  kdf_hash text not null default 'SHA-256',
  updated_at timestamptz not null default now(),
  tombstoned boolean not null default false,
  unique nulls not distinct (owner_id, provider_id, instance_id)
);
create index byok_keys_owner_idx on byok_keys(owner_id, updated_at);

-- chats: mirrors ChatRow
create table chats (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  model_qualified_id text not null,
  settings jsonb not null default '{}'::jsonb,
  parent_chat_id text,
  parent_message_id text,
  pinned boolean default false,
  archived_at timestamptz,
  tags text[] not null default '{}',
  tombstoned boolean not null default false
);
create index chats_owner_idx on chats(owner_id, updated_at);

-- messages: mirrors MessageRow
create table messages (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  chat_id text not null references chats(id) on delete cascade,
  parent_id text references messages(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content text not null,
  content_raw text,
  reasoning text,
  tool_calls jsonb,
  tool_call_id text,
  attachment_ids text[],
  model_requested text,
  model_returned text,
  provider text,
  provider_instance_id text,
  system_prompt_snapshot text,
  sampling_params jsonb,
  mode_applied text,
  token_usage jsonb,
  finish_reason text,
  truncated boolean,
  latency_ms int,
  cost_usd numeric,
  rating smallint check (rating between 1 and 5),
  thumbs_up boolean,
  thumbs_down boolean,
  tags text[] not null default '{}',
  training_include boolean,
  split text check (split in ('train', 'val')),
  error text,
  tombstoned boolean not null default false
);
create index messages_chat_idx on messages(owner_id, chat_id, created_at);
create index messages_owner_updated_idx on messages(owner_id, updated_at);

-- attachments: metadata only; blob lives in Storage bucket
create table attachments (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  message_id text not null references messages(id) on delete cascade,
  kind text not null check (kind in ('image', 'pdf', 'docx', 'text', 'other')),
  name text not null,
  mime text not null,
  size bigint not null,
  storage_path text not null,
  extracted_text text,
  thumbnail_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tombstoned boolean not null default false
);
create index attachments_msg_idx on attachments(owner_id, message_id);
create index attachments_owner_updated_idx on attachments(owner_id, updated_at);

-- attack_chain_runs: mirrors AttackChainRunRow
create table attack_chain_runs (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  chat_id text not null references chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  input text not null,
  layers text[] not null,
  layer_params jsonb not null,
  final_system_prompt text,
  execute_enabled boolean not null,
  results jsonb not null,
  final_output text,
  tags text[] not null default '{}',
  tombstoned boolean not null default false
);
create index attack_chain_runs_chat_idx on attack_chain_runs(owner_id, chat_id, created_at);

-- custom_presets: user-authored chain presets
create table custom_presets (
  id text primary key,
  owner_id uuid not null references auth.users on delete cascade,
  name text not null,
  description text not null default '',
  layers text[] not null,
  layer_params jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tombstoned boolean not null default false
);
create index custom_presets_owner_idx on custom_presets(owner_id, updated_at);

-- RLS: owner isolation on every synced table
alter table profiles enable row level security;
alter table byok_keys enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table attachments enable row level security;
alter table attack_chain_runs enable row level security;
alter table custom_presets enable row level security;

-- profiles: user can read/update own row; cannot insert (trigger handles it)
create policy profiles_select on profiles for select using (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Generic owner-isolation template for the other 6 tables
create policy byok_keys_all on byok_keys for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy chats_all on chats for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy messages_all on messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy attachments_all on attachments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy attack_chain_runs_all on attack_chain_runs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy custom_presets_all on custom_presets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Storage bucket for attachments
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

create policy "owner reads own attachments" on storage.objects
  for select using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner writes own attachments" on storage.objects
  for insert with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes own attachments" on storage.objects
  for delete using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner updates own attachments" on storage.objects
  for update using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
