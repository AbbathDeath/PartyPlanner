-- Atomowy zapis wydatku: kwota, kto zapłacił, lista uczestników, opcjonalnie wagi

create or replace function public.create_expense(
  p_group_id uuid,
  p_title text,
  p_amount numeric,
  p_paid_by uuid,
  p_participants uuid[],
  p_weights numeric[] default null,
  p_event_id uuid default null
)
returns uuid as $$
declare
  v_expense_id uuid;
  v_count int := coalesce(array_length(p_participants, 1), 0);
  v_weights numeric[];
  v_total_weight numeric := 0;
  v_shares numeric[];
  v_sum_shares numeric := 0;
  v_diff numeric;
  v_adjust_idx int := 1;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_group_member';
  end if;

  if p_amount is null or p_amount <= 0 or trim(coalesce(p_title, '')) = '' then
    raise exception 'invalid_expense_data';
  end if;

  if v_count = 0 then
    raise exception 'participants_required';
  end if;

  if v_count <> (select count(distinct u) from unnest(p_participants) as u) then
    raise exception 'duplicate_participants';
  end if;

  -- Brak wag = równy podział (waga 1 dla każdego uczestnika)
  if p_weights is null then
    v_weights := array_fill(1::numeric, array[v_count]);
  else
    if array_length(p_weights, 1) <> v_count then
      raise exception 'weights_length_mismatch';
    end if;
    v_weights := p_weights;
  end if;

  for i in 1..v_count loop
    if v_weights[i] is null or v_weights[i] <= 0 then
      raise exception 'invalid_weight';
    end if;
    v_total_weight := v_total_weight + v_weights[i];
  end loop;

  -- Wyliczenie udziałów z zaokrągleniem do 0.01
  v_shares := array_fill(0::numeric, array[v_count]);
  for i in 1..v_count loop
    v_shares[i] := round((p_amount * v_weights[i]) / v_total_weight, 2);
    v_sum_shares := v_sum_shares + v_shares[i];

    -- Preferujemy doliczenie ewentualnego grosza reszty dłużnikowi, a nie płacącemu
    if p_participants[i] <> p_paid_by and v_adjust_idx = 1 and p_participants[1] = p_paid_by then
      v_adjust_idx := i;
    end if;
  end loop;

  -- Wyrównanie różnicy z zaokrągleń (np. 100.00 / 3 -> 33.34 + 33.33 + 33.33)
  v_diff := round(p_amount - v_sum_shares, 2);
  if v_diff <> 0 then
    v_shares[v_adjust_idx] := v_shares[v_adjust_idx] + v_diff;
  end if;

  insert into public.expenses (group_id, event_id, title, amount, paid_by)
  values (p_group_id, p_event_id, trim(p_title), round(p_amount, 2), p_paid_by)
  returning id into v_expense_id;

  for i in 1..v_count loop
    insert into public.expense_splits (expense_id, user_id, amount, weight)
    values (v_expense_id, p_participants[i], v_shares[i], v_weights[i]);
  end loop;

  return v_expense_id;
end;
$$ language plpgsql set search_path = '';

revoke execute on function public.create_expense(uuid, text, numeric, uuid, uuid[], numeric[], uuid) from public, anon;
grant execute on function public.create_expense(uuid, text, numeric, uuid, uuid[], numeric[], uuid) to authenticated;