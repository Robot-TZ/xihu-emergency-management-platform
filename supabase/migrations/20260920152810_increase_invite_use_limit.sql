-- Raise the default and existing member/admin invite capacity for trial use.
alter table public.team_invites
  alter column max_uses set default 100;

update public.team_invites
set max_uses = 100
where role in ('member', 'admin')
  and max_uses < 100;
