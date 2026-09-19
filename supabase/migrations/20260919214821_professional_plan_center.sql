-- Professional emergency plan lifecycle: plans, immutable versions and task templates.
-- The Supabase CLI package download stalled twice, so this migration was created
-- with the same timestamp/name convention and is applied as a single tracked unit.

create table public.emergency_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique,
  title text not null,
  event_type text not null,
  area text not null default '全区',
  status text not null default 'draft' check (status in ('draft','review','published','retired')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.emergency_plans(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  summary text not null default '',
  content text not null default '',
  response_levels text[] not null default '{}',
  keywords text[] not null default '{}',
  type_weight integer not null default 50 check (type_weight between 0 and 100),
  level_weight integer not null default 30 check (level_weight between 0 and 100),
  keyword_weight integer not null default 20 check (keyword_weight between 0 and 100),
  submitted_at timestamptz,
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, version_no),
  check (type_weight + level_weight + keyword_weight = 100)
);

alter table public.emergency_plans
  add constraint emergency_plans_current_version_fk
  foreign key (current_version_id) references public.plan_versions(id) on delete set null;

create table public.plan_task_templates (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_versions(id) on delete cascade,
  title text not null,
  assignee_role text not null default '应急处置组',
  resource_requirement text not null default '',
  due_minutes integer not null default 30 check (due_minutes > 0),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (version_id, sort_order)
);

alter table public.events
  add column if not exists emergency_plan_id uuid references public.emergency_plans(id) on delete set null,
  add column if not exists plan_version_id uuid references public.plan_versions(id) on delete set null;

alter table public.tasks
  add column if not exists emergency_plan_id uuid references public.emergency_plans(id) on delete set null,
  add column if not exists plan_version_id uuid references public.plan_versions(id) on delete set null;

create index emergency_plans_user_status_idx on public.emergency_plans(user_id, status, updated_at desc);
create index emergency_plans_event_type_idx on public.emergency_plans(event_type, status);
create index plan_versions_plan_status_idx on public.plan_versions(plan_id, status, version_no desc);
create index plan_task_templates_version_order_idx on public.plan_task_templates(version_id, sort_order);
create index events_emergency_plan_idx on public.events(emergency_plan_id, plan_version_id);
create index tasks_emergency_plan_idx on public.tasks(emergency_plan_id, plan_version_id);

alter table public.emergency_plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.plan_task_templates enable row level security;

revoke all on table public.emergency_plans, public.plan_versions, public.plan_task_templates from anon, authenticated;
grant select, insert, update, delete on table public.emergency_plans, public.plan_versions, public.plan_task_templates to authenticated;

create policy "emergency_plans_select_active"
  on public.emergency_plans for select to authenticated
  using ((select private.current_user_active()));
create policy "emergency_plans_insert_writer"
  on public.emergency_plans for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select private.current_user_active())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active)
  );
create policy "emergency_plans_update_owner_or_admin"
  on public.emergency_plans for update to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin())
      or (user_id = (select auth.uid()) and status in ('draft','review') and current_version_id is null)
    )
  )
  with check (
    (select private.current_user_active()) and (
      (select private.is_admin())
      or (user_id = (select auth.uid()) and status in ('draft','review') and current_version_id is null)
    )
  );
create policy "emergency_plans_delete_owner_or_admin"
  on public.emergency_plans for delete to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin()) or (user_id = (select auth.uid()) and status = 'draft')
    )
  );

create policy "plan_versions_select_active"
  on public.plan_versions for select to authenticated
  using ((select private.current_user_active()));
create policy "plan_versions_insert_owner_or_admin"
  on public.plan_versions for insert to authenticated
  with check (
    (select private.current_user_active()) and (
      (select private.is_admin()) or (
        status = 'draft' and published_at is null and created_by = (select auth.uid()) and exists (
          select 1 from public.emergency_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      )
    )
  );
create policy "plan_versions_update_owner_or_admin"
  on public.plan_versions for update to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin()) or (
        status in ('draft','review') and published_at is null and exists (
          select 1 from public.emergency_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      )
    )
  )
  with check (
    (select private.current_user_active()) and (
      (select private.is_admin()) or (
        status in ('draft','review') and published_at is null and exists (
          select 1 from public.emergency_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      )
    )
  );
create policy "plan_versions_delete_owner_or_admin"
  on public.plan_versions for delete to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin()) or (
        status = 'draft' and exists (
          select 1 from public.emergency_plans p
          where p.id = plan_id and p.user_id = (select auth.uid())
        )
      )
    )
  );

create policy "plan_templates_select_active"
  on public.plan_task_templates for select to authenticated
  using ((select private.current_user_active()));
create policy "plan_templates_insert_owner_or_admin"
  on public.plan_task_templates for insert to authenticated
  with check (
    (select private.current_user_active()) and (
      (select private.is_admin()) or exists (
        select 1 from public.plan_versions v join public.emergency_plans p on p.id = v.plan_id
        where v.id = version_id and v.status = 'draft' and p.user_id = (select auth.uid())
      )
    )
  );
create policy "plan_templates_update_owner_or_admin"
  on public.plan_task_templates for update to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin()) or exists (
        select 1 from public.plan_versions v join public.emergency_plans p on p.id = v.plan_id
        where v.id = version_id and v.status = 'draft' and p.user_id = (select auth.uid())
      )
    )
  )
  with check (
    (select private.current_user_active()) and (
      (select private.is_admin()) or exists (
        select 1 from public.plan_versions v join public.emergency_plans p on p.id = v.plan_id
        where v.id = version_id and v.status = 'draft' and p.user_id = (select auth.uid())
      )
    )
  );
create policy "plan_templates_delete_owner_or_admin"
  on public.plan_task_templates for delete to authenticated
  using (
    (select private.current_user_active()) and (
      (select private.is_admin()) or exists (
        select 1 from public.plan_versions v join public.emergency_plans p on p.id = v.plan_id
        where v.id = version_id and v.status = 'draft' and p.user_id = (select auth.uid())
      )
    )
  );
