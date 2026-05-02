create extension if not exists pgcrypto;

create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

create table if not exists app_private.secrets (
  name text primary key,
  value_sha256 text not null,
  updated_at timestamptz not null default now()
);

revoke all on app_private.secrets from public;
revoke all on app_private.secrets from anon;
revoke all on app_private.secrets from authenticated;

create or replace function app_private.assert_cron_secret(secret_value text)
returns void
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  expected_hash text;
begin
  select value_sha256
    into expected_hash
  from app_private.secrets
  where name = 'cron_secret';

  if expected_hash is null
    or encode(digest(coalesce(secret_value, ''), 'sha256'), 'hex') <> expected_hash then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app_private.assert_cron_secret(text) from public;
revoke all on function app_private.assert_cron_secret(text) from anon;
revoke all on function app_private.assert_cron_secret(text) from authenticated;

create or replace function public.get_push_reminder_targets(
  p_secret text,
  p_reminder_type text,
  p_today date,
  p_weight_period text default null,
  p_meal_name text default null
)
returns table (
  user_id uuid,
  endpoint text,
  keys_p256dh text,
  keys_auth text,
  should_send boolean,
  meal_description text
)
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  selected_meal_type_id uuid;
  selected_meal_description text;
begin
  perform app_private.assert_cron_secret(p_secret);

  if p_reminder_type = 'weight' then
    return query
      select
        ps.user_id,
        ps.endpoint,
        ps.keys_p256dh,
        ps.keys_auth,
        not exists (
          select 1
          from public.weight_logs wl
          where wl.user_id = ps.user_id
            and wl.log_date = p_today
            and wl.time_of_day = p_weight_period
        ) as should_send,
        null::text as meal_description
      from public.push_subscriptions ps;
    return;
  end if;

  if p_reminder_type = 'meal' then
    select mt.id
      into selected_meal_type_id
    from public.meal_types mt
    where mt.name = p_meal_name
    limit 1;

    if selected_meal_type_id is not null then
      select mp.description
        into selected_meal_description
      from public.meal_plans mp
      where mp.meal_date = p_today
        and mp.meal_type_id = selected_meal_type_id
      limit 1;
    end if;

    return query
      select
        ps.user_id,
        ps.endpoint,
        ps.keys_p256dh,
        ps.keys_auth,
        true as should_send,
        selected_meal_description as meal_description
      from public.push_subscriptions ps;
    return;
  end if;

  raise exception 'Invalid reminder type' using errcode = '22023';
end;
$$;

revoke all on function public.get_push_reminder_targets(text, text, date, text, text) from public;
grant execute on function public.get_push_reminder_targets(text, text, date, text, text) to anon, authenticated;

create or replace function public.delete_stale_push_subscriptions(
  p_secret text,
  p_endpoints text[]
)
returns integer
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  deleted_count integer;
begin
  perform app_private.assert_cron_secret(p_secret);

  delete from public.push_subscriptions ps
  where ps.endpoint = any(coalesce(p_endpoints, array[]::text[]));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_stale_push_subscriptions(text, text[]) from public;
grant execute on function public.delete_stale_push_subscriptions(text, text[]) to anon, authenticated;