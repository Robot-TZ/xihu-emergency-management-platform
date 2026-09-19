create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('viewer','member','admin')),
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null, response_level text not null, area text not null,
  happened_at timestamptz not null, description text not null, status text not null default '待研判',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade, title text not null, assignee text not null,
  resource text not null default '', status text not null default '待查阅' check (status in ('待查阅','已读','已反馈','已完成')),
  due_minutes integer not null default 30 check (due_minutes > 0), feedback text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.risk_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, area text not null, record_type text not null, source text not null,
  change_type text not null check (change_type in ('新增','变更','删减')), old_value text not null default '', new_value text not null,
  status text not null default '待派单' check (status in ('待派单','待确认','退回核查','已回写')), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null, entity_id uuid, action text not null, detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.team_invites (
  id uuid primary key default gen_random_uuid(), label text not null, code_hash text not null unique,
  role text not null check (role in ('member','admin')), active boolean not null default true,
  max_uses integer not null default 20 check (max_uses > 0), uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create index events_user_created_idx on public.events(user_id, created_at desc);
create index tasks_user_created_idx on public.tasks(user_id, created_at desc);
create index risks_user_created_idx on public.risk_records(user_id, created_at desc);
create index logs_user_created_idx on public.activity_logs(user_id, created_at desc);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin') $$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.risk_records enable row level security;
alter table public.activity_logs enable row level security;
alter table public.team_invites enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using ((select auth.uid()) = id or private.is_admin());
create policy "profiles_insert_viewer" on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'viewer');
create policy "profiles_update_admin" on public.profiles for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "events_select_own_or_admin" on public.events for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());
create policy "events_insert_own_writer" on public.events for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin')));
create policy "events_update_writer_or_admin" on public.events for update to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin()) with check ((select auth.uid()) = user_id or private.is_admin());
create policy "events_delete_writer_or_admin" on public.events for delete to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin());

create policy "tasks_select_own_or_admin" on public.tasks for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());
create policy "tasks_insert_own_writer" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin')));
create policy "tasks_update_writer_or_admin" on public.tasks for update to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin()) with check ((select auth.uid()) = user_id or private.is_admin());
create policy "tasks_delete_writer_or_admin" on public.tasks for delete to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin());

create policy "risks_select_own_or_admin" on public.risk_records for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());
create policy "risks_insert_own_writer" on public.risk_records for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin')));
create policy "risks_update_writer_or_admin" on public.risk_records for update to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin()) with check ((select auth.uid()) = user_id or private.is_admin());
create policy "risks_delete_writer_or_admin" on public.risk_records for delete to authenticated using (((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin'))) or private.is_admin());

create policy "logs_select_own_or_admin" on public.activity_logs for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());
create policy "logs_insert_own_writer" on public.activity_logs for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin')));
create policy "invites_admin_all" on public.team_invites for all to authenticated using (private.is_admin()) with check (private.is_admin());

create or replace function public.redeem_invite(p_code text)
returns text language plpgsql security definer set search_path = ''
as $$
declare invite public.team_invites%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into invite from public.team_invites
    where code_hash = encode(extensions.digest(trim(p_code), 'sha256'), 'hex')
      and active and uses < max_uses and (expires_at is null or expires_at > now())
    for update;
  if not found then raise exception '邀请码无效、已停用或已达使用上限'; end if;
  update public.profiles set role = invite.role where id = auth.uid();
  if not found then raise exception '用户资料尚未初始化，请重新登录后再试'; end if;
  update public.team_invites set uses = uses + 1 where id = invite.id;
  return invite.role;
end;
$$;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events, public.tasks, public.risk_records to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;
revoke all on public.profiles, public.events, public.tasks, public.risk_records, public.activity_logs, public.team_invites from anon;
