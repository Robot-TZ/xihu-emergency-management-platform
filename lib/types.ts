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
  status: "待派单" | "待确认" | "退回核查" | "已回写";
  note?: string;
  assigned_org?: string;
  assignee_user_id?: string | null;
  assignee_organization_id?: string | null;
  writeback_message?: string;
  created_at: string;
};
export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  detail: Record<string, unknown>;
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
