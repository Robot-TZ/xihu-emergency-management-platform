-- Keep publication, retirement and deletion of formal plans under administrator control.
-- Members may author their own drafts and submit versions for review, but cannot
-- bypass the application by calling the data API directly.

drop policy if exists "emergency_plans_update_owner_or_admin" on public.emergency_plans;
drop policy if exists "emergency_plans_delete_owner_or_admin" on public.emergency_plans;
drop policy if exists "plan_versions_insert_owner_or_admin" on public.plan_versions;
drop policy if exists "plan_versions_update_owner_or_admin" on public.plan_versions;
drop policy if exists "plan_versions_delete_owner_or_admin" on public.plan_versions;
drop policy if exists "plan_templates_insert_owner_or_admin" on public.plan_task_templates;
drop policy if exists "plan_templates_update_owner_or_admin" on public.plan_task_templates;
drop policy if exists "plan_templates_delete_owner_or_admin" on public.plan_task_templates;

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
