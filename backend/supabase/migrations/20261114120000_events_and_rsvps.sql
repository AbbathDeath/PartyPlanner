-- Wydarzenia grupowe i odpowiedzi RSVP (task #10, epik #1 Wspólny kalendarz)

-- 1. Funkcja pomocnicza: "czy zalogowany użytkownik jest członkiem tej grupy?"
-- security definer, żeby sprawdzała grupę niezależnie od RLS;
-- dzięki temu jedna prosta funkcja nadaje się do wszystkich polityk poniżej.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and auth.uid() = any(g.members)
  );
$$ language sql stable security definer set search_path = '';

revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- 2. Tabela wydarzeń
create table public.events (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  title text not null,
  event_date date not null,
  event_time time,
  location text,
  description text,
  created_by uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Wydarzenia grupy pobieramy zwykle posortowane po dacie
create index events_group_date_idx on public.events (group_id, event_date);

-- 3. Tabela RSVP: jedna odpowiedź na parę (wydarzenie, użytkownik)
create table public.event_rsvps (
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (event_id, user_id)
);

-- 4. Włączenie RLS
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

-- 5. Polityki dla events: tylko członkowie grupy
create policy "Członkowie grupy widzą jej wydarzenia"
  on public.events for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "Członkowie grupy dodają wydarzenia"
  on public.events for insert
  to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "Autor edytuje swoje wydarzenia"
  on public.events for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.is_group_member(group_id));

create policy "Autor usuwa swoje wydarzenia"
  on public.events for delete
  to authenticated
  using (created_by = auth.uid());

-- 6. Polityki dla event_rsvps
create policy "Członkowie grupy widzą RSVP do jej wydarzeń"
  on public.event_rsvps for select
  to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and public.is_group_member(e.group_id)
  ));

create policy "Użytkownik dodaje własne RSVP"
  on public.event_rsvps for insert
  to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.events e
    where e.id = event_id and public.is_group_member(e.group_id)
  ));

create policy "Użytkownik zmienia własne RSVP"
  on public.event_rsvps for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Użytkownik usuwa własne RSVP"
  on public.event_rsvps for delete
  to authenticated
  using (user_id = auth.uid());


-- 7. Realtime: zmiany w tych tabelach są wysyłane na żywo do subskrybentów (RLS nadal obowiązuje)
alter publication supabase_realtime add table public.events, public.event_rsvps;

-- Przy DELETE Realtime potrzebuje wiedzieć, który wiersz zniknął (a nie tylko jego id)
alter table public.events replica identity full;
alter table public.event_rsvps replica identity full;