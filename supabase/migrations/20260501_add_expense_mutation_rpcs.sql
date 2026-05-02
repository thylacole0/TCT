create or replace function public.update_expense_classification(
  p_expense_id uuid,
  p_budget_week_id uuid,
  p_budget_type text,
  p_category text,
  p_expense_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
      and role <> 'admin'
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_budget_type not in ('comida', 'aseo') then
    raise exception 'Invalid budget type' using errcode = '22023';
  end if;

  update public.expenses
  set
    budget_week_id = p_budget_week_id,
    budget_type = p_budget_type,
    category = p_category,
    expense_date = p_expense_date
  where id = p_expense_id
  returning id into updated_id;

  return updated_id;
end;
$$;

revoke all on function public.update_expense_classification(uuid, uuid, text, text, date) from public;
revoke all on function public.update_expense_classification(uuid, uuid, text, text, date) from anon;
grant execute on function public.update_expense_classification(uuid, uuid, text, text, date) to authenticated;

create or replace function public.delete_expense(
  p_expense_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_id uuid;
begin
  if current_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_user_id
      and role <> 'admin'
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  delete from public.expenses
  where id = p_expense_id
  returning id into deleted_id;

  return deleted_id;
end;
$$;

revoke all on function public.delete_expense(uuid) from public;
revoke all on function public.delete_expense(uuid) from anon;
grant execute on function public.delete_expense(uuid) to authenticated;