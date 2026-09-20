-- Priority 3 and 4: normalized resource/inventory operations and risk survey closure.

create table public.resource_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  code text not null unique,
  name text not null,
  asset_type text not null check (asset_type in ('team','expert','vehicle','equipment','facility')),
  area text not null default '全区',
  address text not null default '',
  longitude numeric(10,7), latitude numeric(10,7),
  contact_name text not null default '', contact_phone text not null default '',
  capabilities text[] not null default '{}',
  capacity numeric(14,2) not null default 1 check (capacity >= 0),
  status text not null default 'available' check (status in ('available','dispatched','maintenance','offline')),
  maintenance_due_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  code text not null unique, name text not null, area text not null,
  address text not null default '', contact_name text not null default '', contact_phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sku text not null unique, name text not null, category text not null, unit text not null,
  min_quantity numeric(14,2) not null default 0 check (min_quantity >= 0),
  max_quantity numeric(14,2) not null default 0 check (max_quantity >= min_quantity),
  maintenance_days integer not null default 365 check (maintenance_days > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  reserved_quantity numeric(14,2) not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, item_id)
);

create table public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_no text not null unique,
  document_type text not null check (document_type in ('inbound','outbound','transfer')),
  from_warehouse_id uuid references public.warehouses(id) on delete restrict,
  to_warehouse_id uuid references public.warehouses(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','pending','approved','cancelled')),
  note text not null default '',
  approved_by uuid references auth.users(id), approved_at timestamptz, cancelled_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (
    (document_type = 'inbound' and from_warehouse_id is null and to_warehouse_id is not null)
    or (document_type = 'outbound' and from_warehouse_id is not null and to_warehouse_id is null)
    or (document_type = 'transfer' and from_warehouse_id is not null and to_warehouse_id is not null and from_warehouse_id <> to_warehouse_id)
  )
);

create table public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14,2) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (document_id, item_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity_delta numeric(14,2) not null check (quantity_delta <> 0),
  reversal_of uuid references public.inventory_movements(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.risk_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  batch_no text not null unique, source_code text not null, file_name text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  total_count integer not null default 0 check (total_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  deleted_count integer not null default 0 check (deleted_count >= 0),
  error_message text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.risk_records
  add column if not exists batch_id uuid references public.risk_import_batches(id) on delete set null,
  add column if not exists source_record_id text not null default '',
  add column if not exists rejection_reason text not null default '',
  add column if not exists confirmed_at timestamptz;
alter table public.risk_records drop constraint if exists risk_records_status_check;
alter table public.risk_records add constraint risk_records_status_check
  check (status in ('待派单','待确认','退回核查','待回写','回写失败','已回写'));

create table public.risk_field_changes (
  id uuid primary key default gen_random_uuid(),
  risk_record_id uuid not null references public.risk_records(id) on delete cascade,
  field_name text not null, old_value text not null default '', new_value text not null default '',
  created_at timestamptz not null default now(),
  unique (risk_record_id, field_name)
);

create table public.risk_writeback_jobs (
  id uuid primary key default gen_random_uuid(),
  risk_record_id uuid not null references public.risk_records(id) on delete cascade,
  adapter_code text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  response_payload jsonb not null default '{}'::jsonb,
  error_message text not null default '', next_retry_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index resource_assets_area_status_idx on public.resource_assets(area, status, asset_type);
create index resource_assets_user_idx on public.resource_assets(user_id);
create index resource_assets_organization_idx on public.resource_assets(organization_id);
create index warehouses_user_idx on public.warehouses(user_id);
create index warehouses_organization_idx on public.warehouses(organization_id);
create index inventory_items_user_idx on public.inventory_items(user_id);
create index inventory_balances_item_idx on public.inventory_balances(item_id);
create index inventory_documents_user_status_idx on public.inventory_documents(user_id, status, created_at desc);
create index inventory_documents_from_idx on public.inventory_documents(from_warehouse_id);
create index inventory_documents_to_idx on public.inventory_documents(to_warehouse_id);
create index inventory_documents_approved_by_idx on public.inventory_documents(approved_by);
create index inventory_document_lines_item_idx on public.inventory_document_lines(item_id);
create index inventory_movements_document_idx on public.inventory_movements(document_id, created_at);
create index inventory_movements_warehouse_item_idx on public.inventory_movements(warehouse_id, item_id, created_at desc);
create index inventory_movements_item_idx on public.inventory_movements(item_id);
create index inventory_movements_reversal_idx on public.inventory_movements(reversal_of) where reversal_of is not null;
create index risk_import_batches_user_created_idx on public.risk_import_batches(user_id, created_at desc);
create index risk_records_batch_idx on public.risk_records(batch_id);
create index risk_records_filter_idx on public.risk_records(area, record_type, source, status, created_at desc);
create index risk_writeback_jobs_risk_idx on public.risk_writeback_jobs(risk_record_id, created_at desc);
create index risk_writeback_jobs_retry_idx on public.risk_writeback_jobs(status, next_retry_at) where status = 'failed';

alter table public.resource_assets enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.risk_import_batches enable row level security;
alter table public.risk_field_changes enable row level security;
alter table public.risk_writeback_jobs enable row level security;

create policy "resource_assets_select_active" on public.resource_assets for select to authenticated using ((select private.current_user_active()));
create policy "resource_assets_insert_writer" on public.resource_assets for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('member','admin') and active));
create policy "resource_assets_update_owner_admin" on public.resource_assets for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy "resource_assets_delete_admin" on public.resource_assets for delete to authenticated using ((select private.is_admin()));

create policy "warehouses_select_active" on public.warehouses for select to authenticated using ((select private.current_user_active()));
create policy "warehouses_insert_writer" on public.warehouses for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()));
create policy "warehouses_update_owner_admin" on public.warehouses for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy "warehouses_delete_admin" on public.warehouses for delete to authenticated using ((select private.is_admin()));

create policy "inventory_items_select_active" on public.inventory_items for select to authenticated using ((select private.current_user_active()));
create policy "inventory_items_insert_writer" on public.inventory_items for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()));
create policy "inventory_items_update_owner_admin" on public.inventory_items for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));
create policy "inventory_items_delete_admin" on public.inventory_items for delete to authenticated using ((select private.is_admin()));

create policy "inventory_balances_select_active" on public.inventory_balances for select to authenticated using ((select private.current_user_active()));
create policy "inventory_balances_admin_insert" on public.inventory_balances for insert to authenticated with check ((select private.is_admin()));
create policy "inventory_balances_admin_update" on public.inventory_balances for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "inventory_documents_select_active" on public.inventory_documents for select to authenticated using ((select private.current_user_active()));
create policy "inventory_documents_insert_writer" on public.inventory_documents for insert to authenticated with check (user_id = (select auth.uid()) and status = 'draft' and (select private.current_user_active()));
create policy "inventory_documents_update_owner_draft_or_admin" on public.inventory_documents for update to authenticated using ((select private.current_user_active()) and ((user_id = (select auth.uid()) and status in ('draft','pending')) or (select private.is_admin()))) with check ((select private.current_user_active()) and ((user_id = (select auth.uid()) and status in ('draft','pending')) or (select private.is_admin())));
create policy "inventory_documents_delete_draft_or_admin" on public.inventory_documents for delete to authenticated using ((select private.current_user_active()) and ((user_id = (select auth.uid()) and status = 'draft') or (select private.is_admin())));

create policy "inventory_lines_select_active" on public.inventory_document_lines for select to authenticated using ((select private.current_user_active()));
create policy "inventory_lines_insert_draft_owner" on public.inventory_document_lines for insert to authenticated with check ((select private.current_user_active()) and exists (select 1 from public.inventory_documents d where d.id = document_id and d.user_id = (select auth.uid()) and d.status = 'draft'));
create policy "inventory_lines_update_draft_owner" on public.inventory_document_lines for update to authenticated using ((select private.current_user_active()) and exists (select 1 from public.inventory_documents d where d.id = document_id and d.user_id = (select auth.uid()) and d.status = 'draft')) with check ((select private.current_user_active()) and exists (select 1 from public.inventory_documents d where d.id = document_id and d.user_id = (select auth.uid()) and d.status = 'draft'));
create policy "inventory_lines_delete_draft_owner_admin" on public.inventory_document_lines for delete to authenticated using ((select private.is_admin()) or exists (select 1 from public.inventory_documents d where d.id = document_id and d.user_id = (select auth.uid()) and d.status = 'draft'));

create policy "inventory_movements_select_active" on public.inventory_movements for select to authenticated using ((select private.current_user_active()));
create policy "inventory_movements_admin_insert" on public.inventory_movements for insert to authenticated with check ((select private.is_admin()));

create policy "risk_batches_select_active" on public.risk_import_batches for select to authenticated using ((select private.current_user_active()));
create policy "risk_batches_insert_writer" on public.risk_import_batches for insert to authenticated with check (user_id = (select auth.uid()) and (select private.current_user_active()));
create policy "risk_batches_update_owner_admin" on public.risk_import_batches for update to authenticated using ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin()))) with check ((select private.current_user_active()) and (user_id = (select auth.uid()) or (select private.is_admin())));

create policy "risk_changes_select_authorized" on public.risk_field_changes for select to authenticated using (exists (select 1 from public.risk_records r where r.id = risk_record_id));
create policy "risk_changes_insert_owner_admin" on public.risk_field_changes for insert to authenticated with check (exists (select 1 from public.risk_records r where r.id = risk_record_id and (r.user_id = (select auth.uid()) or (select private.is_admin()))));
create policy "risk_changes_update_owner_admin" on public.risk_field_changes for update to authenticated using (exists (select 1 from public.risk_records r where r.id = risk_record_id and (r.user_id = (select auth.uid()) or (select private.is_admin())))) with check (exists (select 1 from public.risk_records r where r.id = risk_record_id and (r.user_id = (select auth.uid()) or (select private.is_admin()))));
create policy "risk_changes_delete_owner_admin" on public.risk_field_changes for delete to authenticated using (exists (select 1 from public.risk_records r where r.id = risk_record_id and (r.user_id = (select auth.uid()) or (select private.is_admin()))));

create policy "risk_jobs_select_authorized" on public.risk_writeback_jobs for select to authenticated using (exists (select 1 from public.risk_records r where r.id = risk_record_id));
create policy "risk_jobs_insert_authorized" on public.risk_writeback_jobs for insert to authenticated with check ((select private.current_user_active()) and exists (select 1 from public.risk_records r where r.id = risk_record_id));
create policy "risk_jobs_update_authorized" on public.risk_writeback_jobs for update to authenticated using ((select private.current_user_active()) and exists (select 1 from public.risk_records r where r.id = risk_record_id)) with check ((select private.current_user_active()) and exists (select 1 from public.risk_records r where r.id = risk_record_id));

create or replace function public.post_inventory_document(p_document_id uuid, p_action text)
returns text language plpgsql security invoker set search_path = ''
as $$
declare d public.inventory_documents%rowtype; line record; movement record; current_quantity numeric;
begin
  if not (select private.is_admin()) then raise exception '只有管理员可以审核记账或撤销单据'; end if;
  select * into d from public.inventory_documents where id = p_document_id for update;
  if not found then raise exception '单据不存在或无权操作'; end if;

  if p_action = 'approve' then
    if d.status <> 'pending' then raise exception '只能审核待审核单据'; end if;
    if not exists (select 1 from public.inventory_document_lines where document_id = d.id) then raise exception '单据至少需要一条明细'; end if;
    for line in select * from public.inventory_document_lines where document_id = d.id loop
      if d.document_type in ('outbound','transfer') then
        select quantity into current_quantity from public.inventory_balances where warehouse_id = d.from_warehouse_id and item_id = line.item_id for update;
        if coalesce(current_quantity, 0) < line.quantity then raise exception '库存不足，物资 % 可用 %，需要 %', line.item_id, coalesce(current_quantity, 0), line.quantity; end if;
        update public.inventory_balances set quantity = quantity - line.quantity, updated_at = now() where warehouse_id = d.from_warehouse_id and item_id = line.item_id;
        insert into public.inventory_movements(document_id, warehouse_id, item_id, quantity_delta) values (d.id, d.from_warehouse_id, line.item_id, -line.quantity);
      end if;
      if d.document_type in ('inbound','transfer') then
        insert into public.inventory_balances(warehouse_id, item_id, quantity) values (d.to_warehouse_id, line.item_id, line.quantity)
        on conflict (warehouse_id, item_id) do update set quantity = public.inventory_balances.quantity + excluded.quantity, updated_at = now();
        insert into public.inventory_movements(document_id, warehouse_id, item_id, quantity_delta) values (d.id, d.to_warehouse_id, line.item_id, line.quantity);
      end if;
    end loop;
    update public.inventory_documents set status = 'approved', approved_by = (select auth.uid()), approved_at = now(), updated_at = now() where id = d.id;
    return 'approved';
  elsif p_action = 'cancel' then
    if d.status <> 'approved' then raise exception '只能撤销已记账单据'; end if;
    for movement in select * from public.inventory_movements where document_id = d.id and reversal_of is null order by created_at, id loop
      select quantity into current_quantity from public.inventory_balances where warehouse_id = movement.warehouse_id and item_id = movement.item_id for update;
      if coalesce(current_quantity, 0) - movement.quantity_delta < 0 then raise exception '撤销后库存将为负数，请先处理后续单据'; end if;
      update public.inventory_balances set quantity = quantity - movement.quantity_delta, updated_at = now() where warehouse_id = movement.warehouse_id and item_id = movement.item_id;
      insert into public.inventory_movements(document_id, warehouse_id, item_id, quantity_delta, reversal_of) values (d.id, movement.warehouse_id, movement.item_id, -movement.quantity_delta, movement.id);
    end loop;
    update public.inventory_documents set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = d.id;
    return 'cancelled';
  end if;
  raise exception '不支持的单据操作';
end;
$$;

create or replace function public.queue_risk_writeback(p_risk_id uuid, p_adapter_code text)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare job_id uuid; current_status text;
begin
  select status into current_status from public.risk_records where id = p_risk_id for update;
  if not found then raise exception '风险工单不存在或无权操作'; end if;
  if current_status <> '待确认' then raise exception '只能确认待确认工单'; end if;
  update public.risk_records set status = '待回写', confirmed_at = now(), rejection_reason = '', updated_at = now() where id = p_risk_id;
  insert into public.risk_writeback_jobs(risk_record_id, adapter_code, idempotency_key)
  values (p_risk_id, p_adapter_code, p_adapter_code || ':' || p_risk_id::text)
  on conflict (idempotency_key) do update set status = 'pending', error_message = '', next_retry_at = null, updated_at = now()
  returning id into job_id;
  return job_id;
end;
$$;

create or replace function public.complete_simulated_risk_writeback(p_job_id uuid, p_success boolean, p_error text default '')
returns text language plpgsql security invoker set search_path = ''
as $$
declare job public.risk_writeback_jobs%rowtype;
begin
  select * into job from public.risk_writeback_jobs where id = p_job_id for update;
  if not found then raise exception '回写任务不存在或无权操作'; end if;
  if p_success then
    update public.risk_writeback_jobs set status = 'succeeded', attempt_count = attempt_count + 1, response_payload = jsonb_build_object('adapter', adapter_code, 'simulated', true, 'acknowledged_at', now()), error_message = '', next_retry_at = null, updated_at = now() where id = job.id;
    update public.risk_records set status = '已回写', writeback_message = '模拟适配器已接收；幂等键 ' || job.idempotency_key, updated_at = now() where id = job.risk_record_id;
    return 'succeeded';
  end if;
  update public.risk_writeback_jobs set status = 'failed', attempt_count = attempt_count + 1, error_message = coalesce(nullif(p_error, ''), '模拟接口暂时不可用'), next_retry_at = now() + interval '5 minutes', updated_at = now() where id = job.id;
  update public.risk_records set status = '回写失败', writeback_message = coalesce(nullif(p_error, ''), '模拟接口暂时不可用'), updated_at = now() where id = job.risk_record_id;
  return 'failed';
end;
$$;

revoke all on function public.post_inventory_document(uuid,text) from public, anon;
revoke all on function public.queue_risk_writeback(uuid,text) from public, anon;
revoke all on function public.complete_simulated_risk_writeback(uuid,boolean,text) from public, anon;
grant execute on function public.post_inventory_document(uuid,text) to authenticated;
grant execute on function public.queue_risk_writeback(uuid,text) to authenticated;
grant execute on function public.complete_simulated_risk_writeback(uuid,boolean,text) to authenticated;

grant select, insert, update, delete on public.resource_assets, public.warehouses, public.inventory_items, public.inventory_documents, public.inventory_document_lines, public.risk_import_batches, public.risk_field_changes, public.risk_writeback_jobs to authenticated;
grant select, insert, update on public.inventory_balances to authenticated;
grant select, insert on public.inventory_movements to authenticated;
revoke all on public.resource_assets, public.warehouses, public.inventory_items, public.inventory_balances, public.inventory_documents, public.inventory_document_lines, public.inventory_movements, public.risk_import_batches, public.risk_field_changes, public.risk_writeback_jobs from anon;
