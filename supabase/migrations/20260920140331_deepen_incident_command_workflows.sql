-- Deep incident command workflows, plan collaboration, dispatch, inventory governance and rectification tracking.

alter table public.events
  add column if not exists address text not null default '',
  add column if not exists longitude numeric,
  add column if not exists latitude numeric,
  add column if not exists ended_at timestamptz,
  add column if not exists closed_at timestamptz;

alter table public.tasks
  add column if not exists review_status text not null default 'pending' check (review_status in ('pending','approved','returned')),
  add column if not exists feedback_longitude numeric,
  add column if not exists feedback_latitude numeric,
  add column if not exists returned_reason text not null default '';

alter table public.inventory_documents
  add column if not exists procurement_no text not null default '',
  add column if not exists recipient_name text not null default '';

alter table public.warehouses
  add column if not exists longitude numeric,
  add column if not exists latitude numeric;

alter table public.risk_records
  add column if not exists longitude numeric,
  add column if not exists latitude numeric;

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name text not null,
  responsibility text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  update_type text not null check (update_type in ('处置记录','续报','状态变更','审批申请','审批意见')),
  title text not null,
  content text not null default '',
  from_level text not null default '',
  to_level text not null default '',
  approval_status text not null default 'not_required' check (approval_status in ('not_required','pending','approved','rejected')),
  longitude numeric,
  latitude numeric,
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.business_attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('event','task','plan','review')),
  entity_id uuid not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size >= 0 and file_size <= 20971520),
  category text not null default '文件',
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.task_feedbacks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  feedback_type text not null default '现场反馈' check (feedback_type in ('现场反馈','补充说明','审核意见','退回说明')),
  content text not null,
  longitude numeric,
  latitude numeric,
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.plan_review_comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.plan_versions(id) on delete cascade,
  comment_type text not null default '会签意见' check (comment_type in ('会签意见','审批意见','退回意见')),
  organization_name text not null default '',
  content text not null,
  decision text not null default 'comment' check (decision in ('comment','agree','reject')),
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.resource_dispatches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  resource_id uuid not null references public.resource_assets(id) on delete restrict,
  request_note text not null default '',
  status text not null default 'requested' check (status in ('requested','approved','rejected','dispatched','arrived','returned')),
  user_id uuid not null default auth.uid() references auth.users(id),
  requested_by uuid not null default auth.uid() references auth.users(id),
  approved_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  arrived_at timestamptz,
  returned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (event_id, resource_id, requested_at)
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  batch_no text not null,
  supplier text not null default '',
  procurement_no text not null default '',
  quantity numeric not null default 0 check (quantity >= 0),
  expires_at date,
  user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (warehouse_id, item_id, batch_no)
);

create table public.inventory_stocktakes (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  book_quantity numeric not null,
  actual_quantity numeric not null,
  loss_quantity numeric generated always as (greatest(book_quantity - actual_quantity, 0)) stored,
  reason text not null default '',
  status text not null default 'draft' check (status in ('draft','confirmed')),
  user_id uuid not null default auth.uid() references auth.users(id),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.review_issues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text not null default '',
  responsible_organization text not null,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','rectifying','pending_verification','closed')),
  verification_note text not null default '',
  user_id uuid not null default auth.uid() references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_participants_event_idx on public.event_participants(event_id, created_at);
create index event_updates_event_time_idx on public.event_updates(event_id, created_at desc);
create index business_attachments_entity_idx on public.business_attachments(entity_type, entity_id, created_at desc);
create index task_feedbacks_task_time_idx on public.task_feedbacks(task_id, created_at desc);
create index plan_review_comments_version_idx on public.plan_review_comments(version_id, created_at desc);
create index resource_dispatches_event_status_idx on public.resource_dispatches(event_id, status, updated_at desc);
create index resource_dispatches_resource_idx on public.resource_dispatches(resource_id, status);
create index inventory_batches_expiry_idx on public.inventory_batches(expires_at) where expires_at is not null;
create index inventory_stocktakes_warehouse_idx on public.inventory_stocktakes(warehouse_id, status, created_at desc);
create index review_issues_event_status_idx on public.review_issues(event_id, status, due_at);

alter table public.event_participants enable row level security;
alter table public.event_updates enable row level security;
alter table public.business_attachments enable row level security;
alter table public.task_feedbacks enable row level security;
alter table public.plan_review_comments enable row level security;
alter table public.resource_dispatches enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.inventory_stocktakes enable row level security;
alter table public.review_issues enable row level security;

revoke all on table public.event_participants, public.event_updates, public.business_attachments,
  public.task_feedbacks, public.plan_review_comments, public.resource_dispatches,
  public.inventory_batches, public.inventory_stocktakes, public.review_issues from anon, authenticated;
grant select, insert, update, delete on table public.event_participants, public.event_updates, public.business_attachments,
  public.task_feedbacks, public.plan_review_comments, public.resource_dispatches,
  public.inventory_batches, public.inventory_stocktakes, public.review_issues to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['event_participants','event_updates','business_attachments','task_feedbacks','plan_review_comments','resource_dispatches','inventory_batches','inventory_stocktakes','review_issues'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.current_user_active()))', table_name || '_select_active', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.current_user_active()) and user_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in (''member'',''admin'') and active))', table_name || '_insert_writer', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())))', table_name || '_update_owner_admin', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())))', table_name || '_delete_owner_admin', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-attachments', 'business-attachments', false, 20971520,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "business attachment read" on storage.objects for select to authenticated
using (bucket_id = 'business-attachments' and (select private.current_user_active()));
create policy "business attachment upload" on storage.objects for insert to authenticated
with check (bucket_id = 'business-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.current_user_active()));
create policy "business attachment owner update" on storage.objects for update to authenticated
using (bucket_id = 'business-attachments' and (owner_id = (select auth.uid()::text) or (select private.is_admin())))
with check (bucket_id = 'business-attachments' and (owner_id = (select auth.uid()::text) or (select private.is_admin())));
create policy "business attachment owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'business-attachments' and (owner_id = (select auth.uid()::text) or (select private.is_admin())));

do $$
declare table_name text;
begin
  foreach table_name in array array['events','tasks','monitoring_alerts','event_updates','task_feedbacks','resource_dispatches','review_issues'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
