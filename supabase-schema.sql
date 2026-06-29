create table if not exists public.health_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.health_records enable row level security;

create policy "Users can read own health records"
on public.health_records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own health records"
on public.health_records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own health records"
on public.health_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
