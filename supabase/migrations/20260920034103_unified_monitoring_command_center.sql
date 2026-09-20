-- Priority 5: unified typhoon/city-safety monitoring, rules and alert lifecycle.

create table public.monitoring_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique,
  name text not null,
  domain text not null check (domain in ('typhoon','city')),
  asset_type text not null,
  area text not null default '西湖区',
  address text not null default '',
  longitude numeric(10,7) not null,
  latitude numeric(10,7) not null,
  source_code text not null,
  source_mode text not null default 'simulated' check (source_mode in ('simulated','external')),
  status text not null default 'online' check (status in ('online','offline','maintenance')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monitoring_readings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.monitoring_assets(id) on delete cascade,
  metric_code text not null,
  value numeric(18,6) not null,
  unit text not null,
  measured_at timestamptz not null,
  source_mode text not null default 'simulated' check (source_mode in ('simulated','external')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, metric_code, measured_at)
);

create table public.monitoring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  domain text not null check (domain in ('typhoon','city')),
  asset_type text not null,
  metric_code text not null,
  operator text not null check (operator in ('gte','lte')),
  warning_threshold numeric(18,6) not null,
  critical_threshold numeric(18,6) not null,
  silence_minutes integer not null default 30 check (silence_minutes > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((operator = 'gte' and critical_threshold >= warning_threshold) or (operator = 'lte' and critical_threshold <= warning_threshold)),
  unique (domain, asset_type, metric_code, name)
);

create table public.monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id uuid not null references public.monitoring_assets(id) on delete cascade,
  rule_id uuid references public.monitoring_rules(id) on delete set null,
  fingerprint text not null,
  metric_code text not null,
  measured_value numeric(18,6) not null,
  threshold_value numeric(18,6) not null,
  level text not null check (level in ('warning','critical')),
  status text not null default 'open' check (status in ('open','claimed','verified','converted','closed')),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_triggered_at timestamptz not null,
  last_triggered_at timestamptz not null,
  claimed_by uuid references auth.users(id), claimed_at timestamptz,
  verified_by uuid references auth.users(id), verified_at timestamptz,
  event_id uuid references public.events(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monitoring_alert_actions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.monitoring_alerts(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  action text not null check (action in ('created','deduplicated','claimed','verified','converted','closed')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index monitoring_assets_domain_status_idx on public.monitoring_assets(domain, status, area);
create index monitoring_assets_user_idx on public.monitoring_assets(user_id);
create index monitoring_rules_user_idx on public.monitoring_rules(user_id);
create index monitoring_readings_asset_metric_time_idx on public.monitoring_readings(asset_id, metric_code, measured_at desc);
create index monitoring_rules_domain_match_idx on public.monitoring_rules(domain, asset_type, metric_code) where enabled;
create unique index monitoring_alerts_active_fingerprint_idx on public.monitoring_alerts(fingerprint) where status <> 'closed';
create index monitoring_alerts_asset_status_idx on public.monitoring_alerts(asset_id, status, last_triggered_at desc);
create index monitoring_alerts_user_idx on public.monitoring_alerts(user_id);
create index monitoring_alerts_rule_idx on public.monitoring_alerts(rule_id);
create index monitoring_alerts_claimed_by_idx on public.monitoring_alerts(claimed_by) where claimed_by is not null;
create index monitoring_alerts_verified_by_idx on public.monitoring_alerts(verified_by) where verified_by is not null;
create index monitoring_alerts_event_idx on public.monitoring_alerts(event_id) where event_id is not null;
create index monitoring_alert_actions_alert_time_idx on public.monitoring_alert_actions(alert_id, created_at desc);
create index monitoring_alert_actions_actor_idx on public.monitoring_alert_actions(actor_id) where actor_id is not null;

alter table public.monitoring_assets enable row level security;
alter table public.monitoring_readings enable row level security;
alter table public.monitoring_rules enable row level security;
alter table public.monitoring_alerts enable row level security;
alter table public.monitoring_alert_actions enable row level security;

create policy "monitoring_assets_select_active" on public.monitoring_assets for select to authenticated using ((select private.current_user_active()));
create policy "monitoring_assets_insert_writer" on public.monitoring_assets for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active));
create policy "monitoring_assets_update_owner_admin" on public.monitoring_assets for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy "monitoring_assets_delete_admin" on public.monitoring_assets for delete to authenticated using ((select private.is_admin()));

create policy "monitoring_readings_select_active" on public.monitoring_readings for select to authenticated using ((select private.current_user_active()));
create policy "monitoring_readings_insert_writer" on public.monitoring_readings for insert to authenticated with check ((select private.current_user_active()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active));
create policy "monitoring_readings_delete_admin" on public.monitoring_readings for delete to authenticated using ((select private.is_admin()));

create policy "monitoring_rules_select_active" on public.monitoring_rules for select to authenticated using ((select private.current_user_active()));
create policy "monitoring_rules_insert_writer" on public.monitoring_rules for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active));
create policy "monitoring_rules_update_owner_admin" on public.monitoring_rules for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy "monitoring_rules_delete_admin" on public.monitoring_rules for delete to authenticated using ((select private.is_admin()));

create policy "monitoring_alerts_select_active" on public.monitoring_alerts for select to authenticated using ((select private.current_user_active()));
create policy "monitoring_alerts_insert_writer" on public.monitoring_alerts for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()));
create policy "monitoring_alerts_update_writer" on public.monitoring_alerts for update to authenticated using ((select private.current_user_active()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active)) with check ((select private.current_user_active()));
create policy "monitoring_alerts_delete_admin" on public.monitoring_alerts for delete to authenticated using ((select private.is_admin()));

create policy "monitoring_actions_select_active" on public.monitoring_alert_actions for select to authenticated using ((select private.current_user_active()));
create policy "monitoring_actions_insert_writer" on public.monitoring_alert_actions for insert to authenticated with check (actor_id = (select auth.uid()) and (select private.current_user_active()));
create policy "monitoring_actions_delete_admin" on public.monitoring_alert_actions for delete to authenticated using ((select private.is_admin()));

create or replace function public.ingest_monitoring_reading(
  p_asset_id uuid, p_metric_code text, p_value numeric, p_unit text,
  p_measured_at timestamptz default now(), p_raw_payload jsonb default '{}'::jsonb
)
returns table(reading_id uuid, alert_id uuid, alert_action text)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_asset public.monitoring_assets%rowtype;
  v_rule public.monitoring_rules%rowtype;
  v_reading_id uuid;
  v_alert_id uuid;
  v_level text;
  v_threshold numeric;
  v_created boolean;
begin
  if not (select private.current_user_active()) or not exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active) then
    raise exception '当前账号无监测数据写入权限';
  end if;
  select * into v_asset from public.monitoring_assets where id = p_asset_id;
  if not found then raise exception '设备不存在或无权访问'; end if;
  insert into public.monitoring_readings(asset_id, metric_code, value, unit, measured_at, source_mode, raw_payload)
  values (p_asset_id, trim(p_metric_code), p_value, trim(p_unit), p_measured_at, 'simulated', coalesce(p_raw_payload, '{}'::jsonb))
  on conflict (asset_id, metric_code, measured_at) do update set value = excluded.value, unit = excluded.unit, raw_payload = excluded.raw_payload
  returning id into v_reading_id;
  update public.monitoring_assets set status = 'online', last_seen_at = p_measured_at, updated_at = now() where id = p_asset_id;

  for v_rule in select * from public.monitoring_rules where enabled and domain = v_asset.domain and asset_type = v_asset.asset_type and metric_code = trim(p_metric_code) loop
    if (v_rule.operator = 'gte' and p_value >= v_rule.warning_threshold) or (v_rule.operator = 'lte' and p_value <= v_rule.warning_threshold) then
      if (v_rule.operator = 'gte' and p_value >= v_rule.critical_threshold) or (v_rule.operator = 'lte' and p_value <= v_rule.critical_threshold) then
        v_level := 'critical'; v_threshold := v_rule.critical_threshold;
      else
        v_level := 'warning'; v_threshold := v_rule.warning_threshold;
      end if;
      v_created := false;
      select id into v_alert_id from public.monitoring_alerts where fingerprint = concat(p_asset_id, ':', trim(p_metric_code), ':', v_rule.id) and status <> 'closed' for update;
      if found then
        update public.monitoring_alerts set measured_value = p_value, threshold_value = v_threshold, level = v_level, occurrence_count = occurrence_count + 1, last_triggered_at = p_measured_at, updated_at = now() where id = v_alert_id;
      else
        insert into public.monitoring_alerts(user_id, asset_id, rule_id, fingerprint, metric_code, measured_value, threshold_value, level, first_triggered_at, last_triggered_at)
        values ((select auth.uid()), p_asset_id, v_rule.id, concat(p_asset_id, ':', trim(p_metric_code), ':', v_rule.id), trim(p_metric_code), p_value, v_threshold, v_level, p_measured_at, p_measured_at)
        returning id into v_alert_id;
        v_created := true;
      end if;
      insert into public.monitoring_alert_actions(alert_id, actor_id, action, note)
      values (v_alert_id, (select auth.uid()), case when v_created then 'created' else 'deduplicated' end, case when v_created then '阈值规则首次触发。' else '重复告警已合并计数。' end);
      return query select v_reading_id, v_alert_id, case when v_created then 'created'::text else 'deduplicated'::text end;
      return;
    end if;
  end loop;
  return query select v_reading_id, null::uuid, 'none'::text;
end;
$$;

create or replace function public.transition_monitoring_alert(p_alert_id uuid, p_action text, p_event_id uuid default null)
returns text language plpgsql security invoker set search_path = ''
as $$
declare v_alert public.monitoring_alerts%rowtype; v_next text;
begin
  if not (select private.current_user_active()) or not exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active) then raise exception '当前账号无告警处置权限'; end if;
  select * into v_alert from public.monitoring_alerts where id = p_alert_id for update;
  if not found then raise exception '告警不存在或无权访问'; end if;
  v_next := case p_action when 'claim' then 'claimed' when 'verify' then 'verified' when 'convert' then 'converted' when 'close' then 'closed' else null end;
  if v_next is null then raise exception '不支持的处置动作'; end if;
  if (p_action = 'claim' and v_alert.status <> 'open') or (p_action = 'verify' and v_alert.status not in ('open','claimed')) or (p_action = 'convert' and v_alert.status <> 'verified') or (p_action = 'close' and v_alert.status in ('closed','converted')) then raise exception '当前告警状态不允许该操作'; end if;
  if p_action = 'convert' and p_event_id is null then raise exception '转事件必须提供事件ID'; end if;
  update public.monitoring_alerts set status = v_next,
    claimed_by = case when p_action = 'claim' then (select auth.uid()) else claimed_by end,
    claimed_at = case when p_action = 'claim' then now() else claimed_at end,
    verified_by = case when p_action = 'verify' then (select auth.uid()) else verified_by end,
    verified_at = case when p_action = 'verify' then now() else verified_at end,
    event_id = case when p_action = 'convert' then p_event_id else event_id end,
    closed_at = case when p_action = 'close' then now() else closed_at end,
    updated_at = now() where id = p_alert_id;
  insert into public.monitoring_alert_actions(alert_id, actor_id, action, note) values (p_alert_id, (select auth.uid()), v_next, case when p_action = 'convert' then '告警已转入事件研判。' else concat('告警状态更新为 ', v_next, '。') end);
  return v_next;
end;
$$;

revoke all on public.monitoring_assets, public.monitoring_readings, public.monitoring_rules, public.monitoring_alerts, public.monitoring_alert_actions from anon;
grant select, insert, update, delete on public.monitoring_assets, public.monitoring_rules, public.monitoring_alerts to authenticated;
grant select, insert, delete on public.monitoring_readings, public.monitoring_alert_actions to authenticated;
revoke all on function public.ingest_monitoring_reading(uuid, text, numeric, text, timestamptz, jsonb) from public, anon;
revoke all on function public.transition_monitoring_alert(uuid, text, uuid) from public, anon;
grant execute on function public.ingest_monitoring_reading(uuid, text, numeric, text, timestamptz, jsonb) to authenticated;
grant execute on function public.transition_monitoring_alert(uuid, text, uuid) to authenticated;
