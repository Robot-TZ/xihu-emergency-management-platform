create index if not exists organizations_created_by_idx
  on public.organizations(created_by);
create index if not exists organization_members_created_by_idx
  on public.organization_members(created_by);
create index if not exists team_invites_organization_id_idx
  on public.team_invites(organization_id);
