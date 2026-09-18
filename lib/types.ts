export type Role = "viewer" | "member" | "admin";
export type Profile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  role: Role;
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
  created_at: string;
};
export type TaskRecord = {
  id: string;
  user_id?: string;
  event_id?: string | null;
  title: string;
  assignee: string;
  resource: string;
  status: "待查阅" | "已读" | "已反馈" | "已完成";
  due_minutes: number;
  feedback?: string;
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
  created_at: string;
};
export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  detail: Record<string, unknown>;
  created_at: string;
};
