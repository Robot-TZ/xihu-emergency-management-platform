revoke all on function public.redeem_invite(text) from public, anon, authenticated;
drop function public.redeem_invite(text);

create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  redeemed_role text check (redeemed_role in ('member','admin')),
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
alter table public.invite_redemptions enable row level security;
create policy "redemptions_insert_own" on public.invite_redemptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "redemptions_select_own_or_admin" on public.invite_redemptions for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());

create or replace function private.apply_invite_redemption()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare invite public.team_invites%rowtype;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then raise exception '只能激活当前登录账号'; end if;
  select * into invite from public.team_invites
    where code_hash = new.code_hash and active and uses < max_uses
      and (expires_at is null or expires_at > now())
    for update;
  if not found then raise exception '邀请码无效、已停用或已达使用上限'; end if;
  update public.profiles set role = invite.role where id = new.user_id;
  if not found then raise exception '用户资料尚未初始化，请重新登录后再试'; end if;
  update public.team_invites set uses = uses + 1 where id = invite.id;
  new.redeemed_role := invite.role;
  return new;
end;
$$;
revoke all on function private.apply_invite_redemption() from public, anon, authenticated;
create trigger apply_invite_redemption before insert on public.invite_redemptions
for each row execute function private.apply_invite_redemption();

create index tasks_event_id_idx on public.tasks(event_id);
create index team_invites_created_by_idx on public.team_invites(created_by);
grant select, insert on public.invite_redemptions to authenticated;
revoke all on public.invite_redemptions from anon;
