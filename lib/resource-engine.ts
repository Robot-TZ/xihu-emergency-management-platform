import type { EventRecord, InventoryBalance, InventoryItem, ResourceAsset, Warehouse } from "@/lib/types";

export type ResourceRecommendation = { resource: ResourceAsset; score: number; reasons: string[] };
export type InventoryAlert = { balance: InventoryBalance; item: InventoryItem; warehouse: Warehouse; level: "low" | "high"; message: string };

export function recommendResources(event: EventRecord, resources: ResourceAsset[]) {
  return resources
    .filter((resource) => resource.status === "available")
    .map((resource): ResourceRecommendation => {
      const exactArea = resource.area === event.area;
      const areaMatched = exactArea || resource.area === "全区";
      const matchedCapabilities = resource.capabilities.filter((capability) => event.description.includes(capability) || event.event_type.includes(capability));
      const score = (exactArea ? 60 : areaMatched ? 50 : 20) + Math.min(matchedCapabilities.length * 20, 40);
      return { resource, score, reasons: [exactArea ? "事发区域就近资源" : areaMatched ? "可全区调度" : "需跨区调度", matchedCapabilities.length ? `能力命中：${matchedCapabilities.join("、")}` : "按通用保障能力推荐"] };
    })
    .sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name, "zh-CN"));
}

export function inventoryAlerts(balances: InventoryBalance[], items: InventoryItem[], warehouses: Warehouse[], today = new Date()) {
  void today;
  return balances.flatMap<InventoryAlert>((balance) => {
    const item = items.find((candidate) => candidate.id === balance.item_id);
    const warehouse = warehouses.find((candidate) => candidate.id === balance.warehouse_id);
    if (!item || !warehouse) return [];
    const available = balance.quantity - balance.reserved_quantity;
    if (available < item.min_quantity) return [{ balance, item, warehouse, level: "low" as const, message: `可用库存 ${available}${item.unit}，低于下限 ${item.min_quantity}${item.unit}` }];
    if (balance.quantity > item.max_quantity) return [{ balance, item, warehouse, level: "high" as const, message: `库存 ${balance.quantity}${item.unit}，高于上限 ${item.max_quantity}${item.unit}` }];
    return [];
  });
}

export function resourcesMaintenanceAlerts(resources: ResourceAsset[], today = new Date()) {
  return resources.filter((resource) => resource.maintenance_due_at && new Date(resource.maintenance_due_at) <= today).map((resource) => ({ resource, level: "maintenance" as const, message: `${resource.name}已到维保周期` }));
}

export function applyInventoryDeltas(balances: InventoryBalance[], deltas: Array<{ warehouse_id: string; item_id: string; quantity_delta: number }>, updatedAt: string) {
  const next = balances.map((balance) => ({ ...balance }));
  for (const delta of deltas) {
    let balance = next.find((item) => item.warehouse_id === delta.warehouse_id && item.item_id === delta.item_id);
    if (!balance) {
      balance = { id: `${delta.warehouse_id}-${delta.item_id}`, warehouse_id: delta.warehouse_id, item_id: delta.item_id, quantity: 0, reserved_quantity: 0, updated_at: updatedAt };
      next.push(balance);
    }
    if (balance.quantity + delta.quantity_delta < 0) throw new Error("库存不足，无法审核该单据。");
    balance.quantity += delta.quantity_delta;
    balance.updated_at = updatedAt;
  }
  return next;
}
