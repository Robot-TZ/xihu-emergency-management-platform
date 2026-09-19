create table public.operational_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module text not null check (module in (
    'plans','resources','inventory','duty','monitoring','city_safety',
    'reviews','organizations','integrations','announcements'
  )),
  record_type text not null,
  title text not null,
  status text not null default '正常',
  area text not null default '',
  owner_org text not null default '',
  summary text not null default '',
  source_mode text not null default 'real'
    check (source_mode in ('real','simulated','external')),
  details jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index operational_records_user_created_idx
  on public.operational_records(user_id, created_at desc);
create index operational_records_module_type_idx
  on public.operational_records(module, record_type, created_at desc);
create index operational_records_module_status_idx
  on public.operational_records(module, status, created_at desc);

alter table public.operational_records enable row level security;

create policy "operational_select_own_or_admin"
  on public.operational_records for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
create policy "operational_insert_own_writer"
  on public.operational_records for insert to authenticated
  with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('member','admin')
    )
  );
create policy "operational_update_writer_or_admin"
  on public.operational_records for update to authenticated
  using (
    ((select auth.uid()) = user_id and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('member','admin')
    )) or private.is_admin()
  )
  with check ((select auth.uid()) = user_id or private.is_admin());
create policy "operational_delete_writer_or_admin"
  on public.operational_records for delete to authenticated
  using (
    ((select auth.uid()) = user_id and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('member','admin')
    )) or private.is_admin()
  );

alter table public.profiles
  add column if not exists organization text not null default '',
  add column if not exists job_title text not null default '';

alter table public.tasks
  add column if not exists plan_id uuid references public.operational_records(id) on delete set null,
  add column if not exists channel text not null default '平台内',
  add column if not exists read_at timestamptz,
  add column if not exists feedback_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.events
  add column if not exists plan_id uuid references public.operational_records(id) on delete set null;

alter table public.risk_records
  add column if not exists assigned_org text not null default '',
  add column if not exists writeback_message text not null default '';

create index tasks_plan_id_idx on public.tasks(plan_id);
create index events_plan_id_idx on public.events(plan_id);

grant select, insert, update, delete on public.operational_records to authenticated;
revoke all on public.operational_records from anon;
