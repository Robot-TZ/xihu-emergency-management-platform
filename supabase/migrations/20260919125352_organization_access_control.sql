-- Organization and assignment authorization foundation.
-- The Supabase CLI download was unavailable while this migration was created;
-- the file follows the CLI timestamp/name convention and is applied as one unit.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.organizations(id) on delete set null,
  name text not null,
  code text not null unique,
  org_type text not null check (org_type in ('district','department','town','community','workgroup')),
  area text not null default '',
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null default '',
  membership_role text not null default 'member' check (membership_role in ('member','manager')),
  is_primary boolean not null default false,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.profiles
  add column if not exists active boolean not null default true;

alter table public.tasks
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assignee_organization_id uuid references public.organizations(id) on delete set null;

alter table public.risk_records
  add column if not exists assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assignee_organization_id uuid references public.organizations(id) on delete set null;

alter table public.team_invites
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index organizations_parent_idx on public.organizations(parent_id);
create index organizations_type_active_idx on public.organizations(org_type, active);
create index organization_members_user_idx on public.organization_members(user_id, active);
create index organization_members_org_idx on public.organization_members(organization_id, active);
create index tasks_assignee_user_idx on public.tasks(assignee_user_id, status);
create index tasks_assignee_org_idx on public.tasks(assignee_organization_id, status);
create index risks_assignee_user_idx on public.risk_records(assignee_user_id, status);
create index risks_assignee_org_idx on public.risk_records(assignee_organization_id, status);

create or replace function private.current_user_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and active
  )
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and active
  )
$$;

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_organization_id is not null and exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = (select auth.uid()) and active
  )
$$;

create or replace function private.shares_organization(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user_id = (select auth.uid()) or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and mine.active
      and theirs.user_id = p_user_id and theirs.active
  )
$$;

revoke all on function private.current_user_active() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.is_org_member(uuid) from public, anon, authenticated;
revoke all on function private.shares_organization(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_active() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.shares_organization(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "organizations_select_active_users"
  on public.organizations for select to authenticated
  using ((select private.current_user_active()));
create policy "organizations_admin_insert"
  on public.organizations for insert to authenticated
  with check ((select private.is_admin()));
create policy "organizations_admin_update"
  on public.organizations for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "organizations_admin_delete"
  on public.organizations for delete to authenticated
  using ((select private.is_admin()));

create policy "organization_members_select_scoped"
  on public.organization_members for select to authenticated
  using (
    (select private.is_admin())
    or user_id = (select auth.uid())
    or (select private.is_org_member(organization_id))
  );
create policy "organization_members_admin_insert"
  on public.organization_members for insert to authenticated
  with check ((select private.is_admin()));
create policy "organization_members_admin_update"
  on public.organization_members for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "organization_members_admin_delete"
  on public.organization_members for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_admin_or_org_peer"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or ((select private.current_user_active()) and (select private.shares_organization(id)))
  );

drop policy if exists "tasks_select_own_or_admin" on public.tasks;
drop policy if exists "tasks_insert_own_writer" on public.tasks;
drop policy if exists "tasks_update_writer_or_admin" on public.tasks;
drop policy if exists "tasks_delete_writer_or_admin" on public.tasks;
create policy "tasks_select_authorized"
  on public.tasks for select to authenticated
  using (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  );
create policy "tasks_insert_writer"
  on public.tasks for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select private.current_user_active())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin') and p.active)
  );
create policy "tasks_update_authorized"
  on public.tasks for update to authenticated
  using (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  )
  with check (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  );
create policy "tasks_delete_owner_or_admin"
  on public.tasks for delete to authenticated
  using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));

drop policy if exists "risks_select_own_or_admin" on public.risk_records;
drop policy if exists "risks_insert_own_writer" on public.risk_records;
drop policy if exists "risks_update_writer_or_admin" on public.risk_records;
drop policy if exists "risks_delete_writer_or_admin" on public.risk_records;
create policy "risks_select_authorized"
  on public.risk_records for select to authenticated
  using (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  );
create policy "risks_insert_writer"
  on public.risk_records for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select private.current_user_active())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('member','admin') and p.active)
  );
create policy "risks_update_authorized"
  on public.risk_records for update to authenticated
  using (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  )
  with check (
    (select private.current_user_active()) and (
      user_id = (select auth.uid()) or assignee_user_id = (select auth.uid())
      or (select private.is_org_member(assignee_organization_id))
      or (select private.is_admin())
    )
  );
create policy "risks_delete_owner_or_admin"
  on public.risk_records for delete to authenticated
  using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));

-- A disabled account keeps access to its own profile so the UI can explain the lock,
-- but all operational tables require an active profile.
create policy "events_active_accounts_only"
  on public.events as restrictive for all to authenticated
  using ((select private.current_user_active())) with check ((select private.current_user_active()));
create policy "operational_active_accounts_only"
  on public.operational_records as restrictive for all to authenticated
  using ((select private.current_user_active())) with check ((select private.current_user_active()));
create policy "logs_active_accounts_only"
  on public.activity_logs as restrictive for all to authenticated
  using ((select private.current_user_active())) with check ((select private.current_user_active()));

create or replace function private.assign_invite_organization()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare invite_organization uuid;
begin
  if new.redeemed_role is null then return new; end if;
  select organization_id into invite_organization
  from public.team_invites where code_hash = new.code_hash;
  if invite_organization is not null then
    insert into public.organization_members (organization_id, user_id, created_by, is_primary)
    values (invite_organization, new.user_id, new.user_id, true)
    on conflict (organization_id, user_id)
    do update set active = true, updated_at = now();
  end if;
  return new;
end;
$$;
revoke all on function private.assign_invite_organization() from public, anon, authenticated;
create trigger assign_invite_organization
  after insert on public.invite_redemptions
  for each row execute function private.assign_invite_organization();

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
revoke all on public.organizations, public.organization_members from anon;
