-- Algorytm bilansu par użytkowników w grupie oraz obsługa statusu rozliczeń

-- 1. Wylicza bilans netto dla każdej pary użytkowników w grupie:
--    zwraca wiersze (from_user, to_user, amount), gdzie from_user jest winien to_user.
--    Uwzględnia wszystkie wydatki oraz zatwierdzone rozliczenia (settled = true).
create or replace function public.get_group_balances(p_group_id uuid)
returns table (
  from_user uuid,
  from_display_name text,
  to_user uuid,
  to_display_name text,
  amount numeric(12, 2)
) as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_group_member';
  end if;

  return query
  with raw_flows as (
    -- Długi wynikające z wydatków: uczestnik (debtor) -> osoba płacąca (creditor)
    select
      es.user_id as debtor,
      e.paid_by as creditor,
      es.amount as delta
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
      and es.user_id <> e.paid_by

    union all

    -- Zatwierdzone rozliczenia (settled = true) pomniejszają dług między parą
    select
      s.from_user as debtor,
      s.to_user as creditor,
      -s.amount as delta
    from public.settlements s
    where s.group_id = p_group_id
      and s.settled = true
  ),
  pairwise_net as (
    -- Kanoniczna para (u1 < u2): dodatnia wartość oznacza, że u1 jest winien u2;
    -- ujemna wartość oznacza, że u2 jest winien u1.
    select
      least(debtor, creditor) as u1,
      greatest(debtor, creditor) as u2,
      sum(case when debtor < creditor then delta else -delta end) as net_u1_owes_u2
    from raw_flows
    group by least(debtor, creditor), greatest(debtor, creditor)
  ),
  resolved as (
    select
      case when net_u1_owes_u2 > 0 then u1 else u2 end as res_from,
      case when net_u1_owes_u2 > 0 then u2 else u1 end as res_to,
      abs(net_u1_owes_u2)::numeric(12, 2) as res_amount
    from pairwise_net
    where abs(net_u1_owes_u2) >= 0.01
  )
  select
    r.res_from as from_user,
    pf.display_name as from_display_name,
    r.res_to as to_user,
    pt.display_name as to_display_name,
    r.res_amount as amount
  from resolved r
  join public.profiles pf on pf.id = r.res_from
  join public.profiles pt on pt.id = r.res_to
  order by r.res_amount desc, pf.display_name asc;
end;
$$ language plpgsql stable set search_path = '';

-- 2. Utworzenie wpisu rozliczenia (domyślnie settled = false lub od razu true)
create or replace function public.create_settlement(
  p_group_id uuid,
  p_from_user uuid,
  p_to_user uuid,
  p_amount numeric,
  p_settled boolean default false
)
returns uuid as $$
declare
  v_settlement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_group_member';
  end if;

  insert into public.settlements (group_id, from_user, to_user, amount, settled)
  values (p_group_id, p_from_user, p_to_user, round(p_amount, 2), coalesce(p_settled, false))
  returning id into v_settlement_id;

  return v_settlement_id;
end;
$$ language plpgsql set search_path = '';

-- 3. Oznaczenie istniejącego rozliczenia jako „zapłacone” (aktualizacja statusu w bazie)
create or replace function public.mark_settlement_paid(p_settlement_id uuid)
returns void as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.settlements
  set settled = true
  where id = p_settlement_id
    and public.is_group_member(group_id);

  if not found then
    raise exception 'settlement_not_found_or_forbidden';
  end if;
end;
$$ language plpgsql set search_path = '';

revoke execute on function public.get_group_balances(uuid) from public, anon;
revoke execute on function public.create_settlement(uuid, uuid, uuid, numeric, boolean) from public, anon;
revoke execute on function public.mark_settlement_paid(uuid) from public, anon;

grant execute on function public.get_group_balances(uuid) to authenticated;
grant execute on function public.create_settlement(uuid, uuid, uuid, numeric, boolean) to authenticated;
grant execute on function public.mark_settlement_paid(uuid) to authenticated;