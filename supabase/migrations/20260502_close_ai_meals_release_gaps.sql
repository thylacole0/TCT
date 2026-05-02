do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'meal_plans'
      and c.conname = 'meal_plans_meal_date_meal_type_id_key'
  ) then
    alter table public.meal_plans
      add constraint meal_plans_meal_date_meal_type_id_key unique (meal_date, meal_type_id);
  end if;
end $$;

update public.recipe_ingredients
set normalized_name = trim(regexp_replace(lower(name), '[^[:alnum:] ]+', ' ', 'g'))
where normalized_name is null
  and name is not null;
