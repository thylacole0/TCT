create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  provider text not null,
  model text not null,
  input_json jsonb not null,
  output_json jsonb not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_generations_created_by_date
  on public.ai_generations (created_by, created_at desc);

alter table public.ai_generations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_generations'
      and policyname = 'Users can view own ai generations'
  ) then
    create policy "Users can view own ai generations"
      on public.ai_generations for select
      to authenticated
      using ((select auth.uid()) = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_generations'
      and policyname = 'Users can insert own ai generations'
  ) then
    create policy "Users can insert own ai generations"
      on public.ai_generations for insert
      to authenticated
      with check ((select auth.uid()) = created_by);
  end if;
end $$;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  meal_type_id uuid null references public.meal_types(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  servings integer not null default 1 check (servings > 0),
  calories_per_serving integer null check (calories_per_serving is null or calories_per_serving > 0),
  protein_g numeric null,
  carbs_g numeric null,
  fat_g numeric null,
  health_score integer null,
  health_note text null,
  instructions jsonb not null default '[]'::jsonb,
  ai_generation_id uuid null references public.ai_generations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index if not exists idx_recipes_meal_type_created
  on public.recipes (meal_type_id, created_at desc);

alter table public.recipes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'Authenticated users can view recipes'
  ) then
    create policy "Authenticated users can view recipes"
      on public.recipes for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'Users can insert own recipes'
  ) then
    create policy "Users can insert own recipes"
      on public.recipes for insert
      to authenticated
      with check ((select auth.uid()) = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'Users can update own recipes'
  ) then
    create policy "Users can update own recipes"
      on public.recipes for update
      to authenticated
      using ((select auth.uid()) = created_by)
      with check ((select auth.uid()) = created_by);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'Users can delete own recipes'
  ) then
    create policy "Users can delete own recipes"
      on public.recipes for delete
      to authenticated
      using ((select auth.uid()) = created_by);
  end if;
end $$;

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  normalized_name text null,
  quantity numeric null,
  unit text null,
  is_optional boolean not null default false,
  estimated_calories integer null,
  source text not null check (source in ('available', 'missing', 'suggested')),
  created_at timestamptz not null default now()
);

create index if not exists idx_recipe_ingredients_recipe
  on public.recipe_ingredients (recipe_id);

alter table public.recipe_ingredients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'Authenticated users can view recipe ingredients'
  ) then
    create policy "Authenticated users can view recipe ingredients"
      on public.recipe_ingredients for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'Recipe owners can insert ingredients'
  ) then
    create policy "Recipe owners can insert ingredients"
      on public.recipe_ingredients for insert
      to authenticated
      with check (
        exists (
          select 1 from public.recipes r
          where r.id = recipe_id
            and r.created_by = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'Recipe owners can update ingredients'
  ) then
    create policy "Recipe owners can update ingredients"
      on public.recipe_ingredients for update
      to authenticated
      using (
        exists (
          select 1 from public.recipes r
          where r.id = recipe_id
            and r.created_by = (select auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.recipes r
          where r.id = recipe_id
            and r.created_by = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'Recipe owners can delete ingredients'
  ) then
    create policy "Recipe owners can delete ingredients"
      on public.recipe_ingredients for delete
      to authenticated
      using (
        exists (
          select 1 from public.recipes r
          where r.id = recipe_id
            and r.created_by = (select auth.uid())
        )
      );
  end if;
end $$;

alter table public.shopping_list_items
  add column if not exists source_recipe_id uuid null references public.recipes(id) on delete set null,
  add column if not exists estimated_price numeric null,
  add column if not exists unit text null,
  add column if not exists notes text null,
  add column if not exists converted_expense_id uuid null references public.expenses(id) on delete set null;

create index if not exists idx_shopping_list_items_source_recipe
  on public.shopping_list_items (source_recipe_id);