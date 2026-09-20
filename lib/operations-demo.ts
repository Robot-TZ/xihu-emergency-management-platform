import type { InventoryBalance, InventoryDocument, InventoryDocumentLine, InventoryItem, ResourceAsset, RiskFieldChange, RiskImportBatch, RiskWritebackJob, Warehouse } from "@/lib/types";

const createdAt = "2026-09-20T08:00:00+08:00";

export const demoResources: ResourceAsset[] = [
  { id: "res-team-1", code: "XH-TEAM-001", name: "转塘街道应急队", asset_type: "team", area: "转塘街道", address: "转塘街道办事处", contact_name: "值班长", contact_phone: "0571-00000001", capabilities: ["排涝", "转移", "强降雨"], capacity: 24, status: "available", maintenance_due_at: null, created_at: createdAt },
  { id: "res-vehicle-1", code: "XH-VEH-001", name: "移动排水车", asset_type: "vehicle", area: "全区", address: "区级物资库", contact_name: "车辆调度", contact_phone: "0571-00000002", capabilities: ["积水", "排涝"], capacity: 300, status: "available", maintenance_due_at: "2026-10-10T00:00:00+08:00", created_at: createdAt },
  { id: "res-expert-1", code: "XH-EXP-001", name: "地质灾害专家组", asset_type: "expert", area: "全区", address: "区应急指挥中心", contact_name: "专家联络员", contact_phone: "0571-00000003", capabilities: ["地质灾害", "山体"], capacity: 6, status: "available", maintenance_due_at: null, created_at: createdAt },
];

export const demoWarehouses: Warehouse[] = [
  { id: "wh-district", code: "XH-WH-001", name: "西湖区应急物资中心库", area: "全区", address: "西湖区应急指挥中心", contact_name: "库管员", contact_phone: "0571-00000010", active: true, created_at: createdAt },
  { id: "wh-zhuantang", code: "XH-WH-002", name: "转塘街道前置库", area: "转塘街道", address: "转塘街道", contact_name: "街道库管", contact_phone: "0571-00000011", active: true, created_at: createdAt },
];

export const demoInventoryItems: InventoryItem[] = [
  { id: "item-pump", sku: "XH-WZ-001", name: "移动排涝泵", category: "排涝装备", unit: "台", min_quantity: 3, max_quantity: 20, maintenance_days: 90, created_at: createdAt },
  { id: "item-bag", sku: "XH-WZ-002", name: "防汛沙袋", category: "防汛物资", unit: "只", min_quantity: 500, max_quantity: 5000, maintenance_days: 365, created_at: createdAt },
];

export const demoInventoryBalances: InventoryBalance[] = [
  { id: "bal-1", warehouse_id: "wh-district", item_id: "item-pump", quantity: 8, reserved_quantity: 1, updated_at: createdAt },
  { id: "bal-2", warehouse_id: "wh-district", item_id: "item-bag", quantity: 1200, reserved_quantity: 200, updated_at: createdAt },
  { id: "bal-3", warehouse_id: "wh-zhuantang", item_id: "item-bag", quantity: 300, reserved_quantity: 0, updated_at: createdAt },
];

export const demoInventoryDocuments: InventoryDocument[] = [];
export const demoInventoryDocumentLines: InventoryDocumentLine[] = [];
export const demoInventoryMovements = [];

export const demoRiskBatches: RiskImportBatch[] = [
  { id: "batch-demo", batch_no: "RISK-20260920-001", source_code: "IRS_SIM", file_name: "irs-risk-demo.xlsx", status: "completed", total_count: 2, created_count: 1, changed_count: 1, deleted_count: 0, created_at: createdAt },
];
export const demoRiskFieldChanges: RiskFieldChange[] = [
  { id: "change-demo-1", risk_record_id: "demo-risk-1", field_name: "隐患等级", old_value: "一般", new_value: "较大", created_at: createdAt },
  { id: "change-demo-2", risk_record_id: "demo-risk-1", field_name: "责任单位", old_value: "原属地", new_value: "转塘街道", created_at: createdAt },
];
export const demoRiskWritebackJobs: RiskWritebackJob[] = [];
