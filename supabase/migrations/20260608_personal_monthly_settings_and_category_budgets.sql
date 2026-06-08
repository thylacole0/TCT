-- Personal finance monthly income + per-category budgets
-- Scope: one row per authenticated user and month.

create table if not exists public.personal_monthly_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  monthly_income integer not null default 0 check (monthly_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table if not exists public.personal_category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  category text not null check (category in (
    'Delivery',
    'Supermercado',
    'Transporte',
    'Gustos personales',
    'Gastos del hogar',
    'Suscripciones',
    'Otros'
  )),
  budget_amount integer not null default 0 check (budget_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month, category)
);

create index if not exists idx_personal_monthly_settings_user_month
  on public.personal_monthly_settings(user_id, month);

create index if not exists idx_personal_category_budgets_user_month
  on public.personal_category_budgets(user_id, month);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_personal_monthly_settings_updated_at on public.personal_monthly_settings;
create trigger trg_personal_monthly_settings_updated_at
  before update on public.personal_monthly_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_personal_category_budgets_updated_at on public.personal_category_budgets;
create trigger trg_personal_category_budgets_updated_at
  before update on public.personal_category_budgets
  for each row execute function public.set_updated_at();

alter table public.personal_monthly_settings enable row level security;
alter table public.personal_category_budgets enable row level security;

drop policy if exists "Users can read own personal monthly settings" on public.personal_monthly_settings;
create policy "Users can read own personal monthly settings"
  on public.personal_monthly_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own personal monthly settings" on public.personal_monthly_settings;
create policy "Users can insert own personal monthly settings"
  on public.personal_monthly_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own personal monthly settings" on public.personal_monthly_settings;
create policy "Users can update own personal monthly settings"
  on public.personal_monthly_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own personal category budgets" on public.personal_category_budgets;
create policy "Users can read own personal category budgets"
  on public.personal_category_budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own personal category budgets" on public.personal_category_budgets;
create policy "Users can insert own personal category budgets"
  on public.personal_category_budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own personal category budgets" on public.personal_category_budgets;
create policy "Users can update own personal category budgets"
  on public.personal_category_budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
