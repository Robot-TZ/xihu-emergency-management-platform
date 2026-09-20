-- Cover foreign keys reported by the database advisor after the closure migration.
create index resource_assets_user_idx on public.resource_assets(user_id);
create index warehouses_user_idx on public.warehouses(user_id);
create index inventory_items_user_idx on public.inventory_items(user_id);
create index inventory_balances_item_idx on public.inventory_balances(item_id);
create index inventory_documents_approved_by_idx on public.inventory_documents(approved_by);
create index inventory_movements_item_idx on public.inventory_movements(item_id);
create index inventory_movements_reversal_idx on public.inventory_movements(reversal_of) where reversal_of is not null;
