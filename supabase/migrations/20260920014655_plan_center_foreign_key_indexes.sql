-- Cover every new foreign key with a leading-column index.
create index emergency_plans_current_version_idx on public.emergency_plans(current_version_id);
create index events_plan_version_idx on public.events(plan_version_id);
create index plan_versions_created_by_idx on public.plan_versions(created_by);
create index tasks_plan_version_idx on public.tasks(plan_version_id);
