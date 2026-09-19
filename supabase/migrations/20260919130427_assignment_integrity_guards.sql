create or replace function private.protect_assignment_fields()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not (select private.is_admin()) and (
    new.user_id is distinct from old.user_id
    or new.assignee_user_id is distinct from old.assignee_user_id
    or new.assignee_organization_id is distinct from old.assignee_organization_id
  ) then
    raise exception '只有管理员可以修改工单归属和指派对象';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_assignment_fields() from public, anon, authenticated;
create trigger protect_task_assignment
  before update on public.tasks
  for each row execute function private.protect_assignment_fields();
create trigger protect_risk_assignment
  before update on public.risk_records
  for each row execute function private.protect_assignment_fields();

create or replace function private.prevent_self_lockout()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.id = (select auth.uid()) and old.active and not new.active then
    raise exception '不能停用当前登录的管理员账号';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_self_lockout() from public, anon, authenticated;
create trigger prevent_profile_self_lockout
  before update of active on public.profiles
  for each row execute function private.prevent_self_lockout();
