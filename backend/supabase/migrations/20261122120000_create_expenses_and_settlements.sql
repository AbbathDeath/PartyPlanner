-- Wydatki grupowe i rozliczenia — struktura danych oraz RLS

-- 1. Tabela wydatków
create table public.expenses (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) on delete restrict not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index expenses_group_created_idx on public.expenses (group_id, created_at desc);
create index expenses_event_idx on public.expenses (event_id) where event_id is not null;

-- 2. Tabela podziału wydatku na uczestników (kwota udziału + opcjonalna waga)
create table public.expense_splits (
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete restrict not null,
  amount numeric(12, 2) not null check (amount >= 0),
  weight numeric(10, 4) not null default 1 check (weight > 0),
  primary key (expense_id, user_id)
);

create index expense_splits_user_idx on public.expense_splits (user_id);

-- 3. Tabela rozliczeń między parami użytkowników
-- (kolumny from_user / to_user zamiast słów kluczowych SQL from / to)
create table public.settlements (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  from_user uuid references public.profiles(id) on delete restrict not null,
  to_user uuid references public.profiles(id) on delete restrict not null,
  amount numeric(12, 2) not null check (amount > 0),
  settled boolean not null default false,
  settled_at timestamp with time zone,
  settled_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint settlements_distinct_users check (from_user <> to_user)
);

create index settlements_group_settled_idx on public.settlements (group_id, settled);

-- 4. Widok zwracający wydatek w formacie ze specyfikacji:
-- { id, group_id, event_id, title, amount, paid_by, participants: uuid[], splits: { userId: amount }, created_at }
-- security_invoker = true wymusza respektowanie polityk RLS z tabel bazowych.
create view public.expenses_details
with (security_invoker = true) as
select
  e.id,
  e.group_id,
  e.event_id,
  e.title,
  e.amount,
  e.paid_by,
  e.created_by,
  e.created_at,
  coalesce(array_agg(es.user_id order by es.user_id) filter (where es.user_id is not null), array[]::uuid[]) as participants,
  coalesce(jsonb_object_agg(es.user_id::text, es.amount) filter (where es.user_id is not null), '{}'::jsonb) as splits
from public.expenses e
left join public.expense_splits es on es.expense_id = e.id
group by e.id;

-- 5. Funkcja pomocnicza sprawdzająca członkostwo dowolnego user_id w grupie
create or replace function public.is_user_in_group(p_group_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and p_user_id = any(g.members)
  );
$$ language sql stable security definer set search_path = '';

revoke execute on function public.is_user_in_group(uuid, uuid) from public, anon;
grant execute on function public.is_user_in_group(uuid, uuid) to authenticated;

-- 6. Triggery walidujące spójność danych z grupą oraz status rozliczeń
create or replace function public.validate_expense()
returns trigger as $$
begin
  if not public.is_user_in_group(new.group_id, new.paid_by) then
    raise exception 'payer_not_in_group';
  end if;

  if new.event_id is not null then
    if not exists (
      select 1 from public.events e
      where e.id = new.event_id and e.group_id = new.group_id
    ) then
      raise exception 'event_not_in_group';
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = '';

create trigger on_expense_validate
  before insert or update on public.expenses
  for each row execute procedure public.validate_expense();

create or replace function public.validate_expense_split()
returns trigger as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id
  from public.expenses
  where id = new.expense_id;

  if v_group_id is null or not public.is_user_in_group(v_group_id, new.user_id) then
    raise exception 'participant_not_in_group';
  end if;

  return new;
end;
$$ language plpgsql set search_path = '';

create trigger on_expense_split_validate
  before insert or update on public.expense_splits
  for each row execute procedure public.validate_expense_split();

create or replace function public.handle_settlement_upsert()
returns trigger as $$
begin
  if not public.is_user_in_group(new.group_id, new.from_user)
     or not public.is_user_in_group(new.group_id, new.to_user) then
    raise exception 'settlement_users_not_in_group';
  end if;

  if new.settled = true and (tg_op = 'INSERT' or old.settled = false) then
    new.settled_at := coalesce(new.settled_at, timezone('utc'::text, now()));
    new.settled_by := coalesce(new.settled_by, auth.uid());
  elsif new.settled = false then
    new.settled_at := null;
    new.settled_by := null;
  end if;

  return new;
end;
$$ language plpgsql set search_path = '';

create trigger on_settlement_upsert
  before insert or update on public.settlements
  for each row execute procedure public.handle_settlement_upsert();

-- 7. Włączenie RLS
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

-- 8. Polityki RLS dla expenses (tylko członkowie grupy)
create policy "Członkowie grupy widzą wydatki"
  on public.expenses for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "Członkowie grupy dodają wydatki"
  on public.expenses for insert
  to authenticated
  with check (public.is_group_member(group_id));

create policy "Członkowie grupy edytują wydatki"
  on public.expenses for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Członkowie grupy usuwają wydatki"
  on public.expenses for delete
  to authenticated
  using (public.is_group_member(group_id));

-- 9. Polityki RLS dla expense_splits (tylko członkowie grupy)
create policy "Członkowie grupy widzą podziały wydatków"
  on public.expense_splits for select
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

create policy "Członkowie grupy dodają podziały wydatków"
  on public.expense_splits for insert
  to authenticated
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

create policy "Członkowie grupy edytują podziały wydatków"
  on public.expense_splits for update
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

create policy "Członkowie grupy usuwają podziały wydatków"
  on public.expense_splits for delete
  to authenticated
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)
  ));

-- 10. Polityki RLS dla settlements (tylko członkowie grupy)
create policy "Członkowie grupy widzą rozliczenia"
  on public.settlements for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "Członkowie grupy tworzą rozliczenia"
  on public.settlements for insert
  to authenticated
  with check (public.is_group_member(group_id));

create policy "Członkowie grupy aktualizują rozliczenia"
  on public.settlements for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Członkowie grupy usuwają rozliczenia"
  on public.settlements for delete
  to authenticated
  using (public.is_group_member(group_id));

-- 11. Realtime (spójnie z events i event_rsvps)
alter publication supabase_realtime add table
  public.expenses,
  public.expense_splits,
  public.settlements;

alter table public.expenses replica identity full;
alter table public.expense_splits replica identity full;
alter table public.settlements replica identity full;