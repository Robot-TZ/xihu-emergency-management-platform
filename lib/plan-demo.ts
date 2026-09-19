import type { EmergencyPlan, PlanTaskTemplate, PlanVersion } from "@/lib/types";

const createdAt = "2026-09-19T08:00:00+08:00";

export const demoPlans: EmergencyPlan[] = [
  { id: "plan-rain", code: "XH-YA-BY-001", title: "西湖区暴雨内涝应急处置预案", event_type: "暴雨内涝", area: "全区", status: "published", current_version_id: "plan-rain-v1", created_at: createdAt },
  { id: "plan-typhoon", code: "XH-YA-TF-001", title: "西湖区防台风应急预案", event_type: "台风", area: "全区", status: "published", current_version_id: "plan-typhoon-v1", created_at: createdAt },
];

export const demoPlanVersions: PlanVersion[] = [
  { id: "plan-rain-v1", plan_id: "plan-rain", version_no: 1, status: "published", summary: "短时强降雨、道路积水和人员转移场景处置。", content: "启动后完成排涝、转移、交通疏导和信息报送。", response_levels: ["II级", "III级", "IV级"], keywords: ["积水", "强降雨", "排涝", "转移"], type_weight: 50, level_weight: 30, keyword_weight: 20, published_at: createdAt, created_at: createdAt },
  { id: "plan-typhoon-v1", plan_id: "plan-typhoon", version_no: 1, status: "published", summary: "台风、大风和沿湖高风险区域响应。", content: "开展巡查加固、人员转移和物资前置。", response_levels: ["I级", "II级", "III级"], keywords: ["台风", "大风", "转移"], type_weight: 50, level_weight: 30, keyword_weight: 20, published_at: createdAt, created_at: createdAt },
];

export const demoPlanTaskTemplates: PlanTaskTemplate[] = [
  { id: "tpl-rain-1", version_id: "plan-rain-v1", title: "排涝作业", assignee_role: "属地应急队", resource_requirement: "移动排涝泵", due_minutes: 20, sort_order: 1, created_at: createdAt },
  { id: "tpl-rain-2", version_id: "plan-rain-v1", title: "人员转移", assignee_role: "属地街道", resource_requirement: "转运车辆和安置点", due_minutes: 30, sort_order: 2, created_at: createdAt },
  { id: "tpl-rain-3", version_id: "plan-rain-v1", title: "交通疏导", assignee_role: "交通保障组", resource_requirement: "警示设施", due_minutes: 30, sort_order: 3, created_at: createdAt },
  { id: "tpl-typhoon-1", version_id: "plan-typhoon-v1", title: "巡查加固", assignee_role: "属地工作组", resource_requirement: "加固器材", due_minutes: 30, sort_order: 1, created_at: createdAt },
  { id: "tpl-typhoon-2", version_id: "plan-typhoon-v1", title: "人员转移", assignee_role: "属地街道", resource_requirement: "转运车辆", due_minutes: 45, sort_order: 2, created_at: createdAt },
  { id: "tpl-typhoon-3", version_id: "plan-typhoon-v1", title: "物资前置", assignee_role: "物资保障组", resource_requirement: "应急物资", due_minutes: 60, sort_order: 3, created_at: createdAt },
];
