-- Follow-up indexes for foreign keys reported by the database advisor.
create index monitoring_rules_user_idx on public.monitoring_rules(user_id);
create index monitoring_alerts_user_idx on public.monitoring_alerts(user_id);
