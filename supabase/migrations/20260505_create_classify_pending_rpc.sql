-- RPC called by the Hermes classification script.
-- Uses SECURITY DEFINER to bypass RLS and write expenses on behalf of any user.
-- Grant EXECUTE to the anon role so the Python script can call it with just the anon key.

create or replace function public.classify_pending_expense(
  p_pending_id uuid,
  p_merchant text,
  p_amount numeric,
  p_description text,
  p_category text default 'General',
  p_subcategory text default null,
  p_expense_date date default current_date,
  p_budget_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_expense_id uuid;
  v_budget_week_id uuid;
  v_final_budget_type text;
  v_period_start date;
  v_period_end date;
  v_full_desc text;
begin
  -- 1. Read the pending record (must exist and be pending)
  select pe.user_id, pe.raw_text
  into v_user_id
  from public.pending_expenses pe
  where pe.id = p_pending_id
    and pe.status = 'pending';

  if v_user_id is null then
    return jsonb_build_object(
      'error', 'Pending expense not found or already classified'
    );
  end if;

  -- 2. Validate and set budget_type
  if p_budget_type is not null and p_budget_type not in ('comida', 'aseo') then
    return jsonb_build_object(
      'error', 'Invalid budget_type. Must be comida, aseo, or null'
    );
  end if;

  -- 3. Resolve budget_week_id (mirrors resolveBudgetForExpense in budgets.ts)
  v_final_budget_type := p_budget_type;

  if v_final_budget_type is not null then
    -- Compute period start
    if v_final_budget_type = 'comida' then
      -- Monday of the expense week
      v_period_start := p_expense_date - ((extract(dow from p_expense_date) + 6) % 7)::integer;
    else
      -- First of the expense month
      v_period_start := date_trunc('month', p_expense_date)::date;
    end if;

    -- Try to find an existing budget_week
    select bw.id into v_budget_week_id
    from public.budget_weeks bw
    where bw.budget_type = v_final_budget_type
      and bw.week_start = v_period_start;
  end if;

  -- 4. Build full description
  v_full_desc := case
    when p_subcategory is not null and p_subcategory <> '' then
      p_merchant || ' - ' || p_subcategory
    else
      p_description
  end;

  -- 5. Insert the expense
  insert into public.expenses (
    user_id,
    merchant,
    amount,
    description,
    category,
    expense_date,
    budget_type,
    budget_week_id
  ) values (
    v_user_id,
    p_merchant,
    round(p_amount),
    v_full_desc,
    p_category,
    p_expense_date,
    v_final_budget_type,
    v_budget_week_id
  )
  returning id into v_expense_id;

  -- 6. Mark pending as classified
  update public.pending_expenses
  set
    status = 'classified',
    merchant = p_merchant,
    amount = round(p_amount),
    category = p_category,
    expense_date = p_expense_date,
    classified_at = now()
  where id = p_pending_id;

  -- 7. Return success
  return jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id,
    'budget_week_id', v_budget_week_id,
    'budget_type', v_final_budget_type
  );

exception
  when others then
    return jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
end;
$$;

-- Grant execute to anon role so the Python script can call this with the anon key
revoke all on function public.classify_pending_expense(uuid, text, numeric, text, text, text, date, text) from public;
revoke all on function public.classify_pending_expense(uuid, text, numeric, text, text, text, date, text) from anon;
grant execute on function public.classify_pending_expense(uuid, text, numeric, text, text, text, date, text) to anon;
