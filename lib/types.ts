export type Role = "viewer" | "member" | "admin";
export type Profile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  role: Role;
  organization?: string;
  job_title?: string;
  active: boolean;
  created_at: string;
};
export type OrganizationType = "district" | "department" | "town" | "community" | "workgroup";
export type Organization = {
  id: string;
  parent_id?: string | null;
  name: string;
  code: string;
  org_type: OrganizationType;
  area: string;
  active: boolean;
  created_at: string;
};
export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  position: string;
  membership_role: "member" | "manager";
  is_primary: boolean;
  active: boolean;
  created_at: string;
};
export type TeamInvite = {
  id: string;
  label: string;
  role: "member" | "admin";
  active: boolean;
  max_uses: number;
  uses: number;
  expires_at?: string | null;
  organization_id?: string | null;
  created_at: string;
};
export type EventRecord = {
  id: string;
  user_id?: string;
  event_type: string;
  response_level: string;
  area: string;
  happened_at: string;
  description: string;
  status: string;
  plan_id?: string | null;
  emergency_plan_id?: string | null;
  plan_version_id?: string | null;
  created_at: string;
};
export type TaskRecord = {
  id: string;
  user_id?: string;
  event_id?: string | null;
  title: string;
  assignee: string;
  assignee_user_id?: string | null;
  assignee_organization_id?: string | null;
  resource: string;
  status: "待查阅" | "已读" | "已反馈" | "已完成";
  due_minutes: number;
  feedback?: string;
  plan_id?: string | null;
  emergency_plan_id?: string | null;
  plan_version_id?: string | null;
  channel?: string;
  read_at?: string | null;
  feedback_at?: string | null;
  completed_at?: string | null;
  created_at: string;
};
export type RiskRecord = {
  id: string;
  user_id?: string;
  name: string;
  area: string;
  record_type: string;
  source: string;
  change_type: "新增" | "变更" | "删减";
  old_value: string;
  new_value: string;
  status: "待派单" | "待确认" | "退回核查" | "待回写" | "回写失败" | "已回写";
  note?: string;
  assigned_org?: string;
  assignee_user_id?: string | null;
  assignee_organization_id?: string | null;
  writeback_message?: string;
  batch_id?: string | null;
  source_record_id?: string;
  rejection_reason?: string;
  confirmed_at?: string | null;
  created_at: string;
};

export type ResourceAssetType = "team" | "expert" | "vehicle" | "equipment" | "facility";
export type ResourceAsset = {
  id: string;
  user_id?: string;
  organization_id?: string | null;
  code: string;
  name: string;
  asset_type: ResourceAssetType;
  area: string;
  address: string;
  longitude?: number | null;
  latitude?: number | null;
  contact_name: string;
  contact_phone: string;
  capabilities: string[];
  capacity: number;
  status: "available" | "dispatched" | "maintenance" | "offline";
  maintenance_due_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type Warehouse = {
  id: string;
  user_id?: string;
  organization_id?: string | null;
  code: string;
  name: string;
  area: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  active: boolean;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  user_id?: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  min_quantity: number;
  max_quantity: number;
  maintenance_days: number;
  created_at: string;
};

export type InventoryBalance = {
  id: string;
  warehouse_id: string;
  item_id: string;
  quantity: number;
  reserved_quantity: number;
  updated_at: string;
};

export type InventoryDocumentType = "inbound" | "outbound" | "transfer";
export type InventoryDocument = {
  id: string;
  user_id?: string;
  document_no: string;
  document_type: InventoryDocumentType;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  status: "draft" | "pending" | "approved" | "cancelled";
  note: string;
  approved_by?: string | null;
  approved_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
};

export type InventoryDocumentLine = {
  id: string;
  document_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
};

export type InventoryMovement = {
  id: string;
  document_id: string;
  warehouse_id: string;
  item_id: string;
  quantity_delta: number;
  reversal_of?: string | null;
  created_at: string;
};

export type RiskImportBatch = {
  id: string;
  user_id?: string;
  batch_no: string;
  source_code: string;
  file_name: string;
  status: "processing" | "completed" | "failed";
  total_count: number;
  created_count: number;
  changed_count: number;
  deleted_count: number;
  error_message?: string;
  created_at: string;
};

export type RiskFieldChange = {
  id: string;
  risk_record_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  created_at: string;
};

export type RiskWritebackJob = {
  id: string;
  risk_record_id: string;
  adapter_code: string;
  idempotency_key: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempt_count: number;
  response_payload?: Record<string, unknown>;
  error_message?: string;
  next_retry_at?: string | null;
  created_at: string;
  updated_at?: string;
};
export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type EmergencyPlanStatus = "draft" | "review" | "published" | "retired";
export type PlanVersionStatus = "draft" | "review" | "published" | "archived";

export type EmergencyPlan = {
  id: string;
  user_id?: string;
  code: string;
  title: string;
  event_type: string;
  area: string;
  status: EmergencyPlanStatus;
  current_version_id?: string | null;
  created_at: string;
  updated_at?: string;
};

export type PlanVersion = {
  id: string;
  plan_id: string;
  version_no: number;
  status: PlanVersionStatus;
  summary: string;
  content: string;
  response_levels: string[];
  keywords: string[];
  type_weight: number;
  level_weight: number;
  keyword_weight: number;
  submitted_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type PlanTaskTemplate = {
  id: string;
  version_id: string;
  title: string;
  assignee_role: string;
  resource_requirement: string;
  due_minutes: number;
  sort_order: number;
  created_at: string;
};

export type ProductModule =
  | "plans" | "resources" | "inventory" | "duty" | "monitoring"
  | "city_safety" | "reviews" | "organizations" | "integrations"
  | "announcements";

export type SourceMode = "real" | "simulated" | "external";

export type OperationalRecord = {
  id: string;
  user_id?: string;
  module: ProductModule;
  record_type: string;
  title: string;
  status: string;
  area: string;
  owner_org: string;
  summary: string;
  source_mode: SourceMode;
  details: Record<string, string | number | boolean | string[] | null>;
  due_at?: string | null;
  created_at: string;
  updated_at?: string;
};
