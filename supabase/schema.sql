-- Kör i Supabase → SQL Editor. Skapar tabellen som appen synkar mot.
-- Alla poster ligger i en generisk tabell (collection + id), med Row Level Security så att
-- varje användare bara ser sina egna rader.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;

drop policy if exists "egna rader" on public.records;
create policy "egna rader" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Servern sätter tidsstämpeln så att klockor på enheter inte spelar roll.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_updated_at();

-- ===== Push-notiser (3.3) =====

-- Enheter som tagit emot notiser (en rad per webbläsarprenumeration).
create table if not exists public.push_subscriptions (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

-- Färdiga notiser som appen räknat ut (14 dagar framåt). Servern skickar dem när fire_at passerat.
create table if not exists public.notifications (
  user_id uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id      text        not null,
  fire_at timestamptz not null,
  title   text        not null,
  body    text        not null,
  sent    boolean     not null default false,
  primary key (user_id, id)
);
create index if not exists notifications_due_idx on public.notifications (fire_at) where sent = false;

alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "egna prenumerationer" on public.push_subscriptions;
create policy "egna prenumerationer" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "egna notiser" on public.notifications;
create policy "egna notiser" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
