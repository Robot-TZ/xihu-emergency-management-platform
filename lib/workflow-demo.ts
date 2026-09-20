import type { BusinessAttachment, EventParticipant, EventUpdate, InventoryBatch, InventoryStocktake, PlanReviewComment, ResourceDispatch, ReviewIssue, TaskFeedback } from "./types";

const createdAt = "2026-09-20T08:10:00+08:00";

export const demoEventParticipants: EventParticipant[] = [
  { id: "participant-1", event_id: "demo-event-1", organization_name: "转塘街道办事处", responsibility: "属地统筹与人员转移", contact_name: "值班负责人", contact_phone: "0571-00000021", created_at: createdAt },
  { id: "participant-2", event_id: "demo-event-1", organization_name: "区应急管理局", responsibility: "综合协调与资源调度", contact_name: "指挥中心", contact_phone: "0571-00000022", created_at: createdAt },
];

export const demoEventUpdates: EventUpdate[] = [
  { id: "event-update-1", event_id: "demo-event-1", update_type: "处置记录", title: "现场核查完成", content: "确认道路积水约30厘米，已设置警戒并启动排涝。", from_level: "", to_level: "", approval_status: "not_required", longitude: 120.078, latitude: 30.159, created_at: createdAt },
  { id: "event-update-2", event_id: "demo-event-1", update_type: "续报", title: "第一次续报", content: "积水范围未继续扩大，转移工作有序进行。", from_level: "", to_level: "", approval_status: "not_required", created_at: "2026-09-20T08:25:00+08:00" },
];

export const demoBusinessAttachments: BusinessAttachment[] = [];
export const demoTaskFeedbacks: TaskFeedback[] = [];
export const demoPlanComments: PlanReviewComment[] = [
  { id: "plan-comment-1", version_id: "plan-rain-v1", comment_type: "会签意见", organization_name: "转塘街道", content: "建议在人员转移任务中增加独居老人核查要求。", decision: "comment", created_at: createdAt },
];
export const demoResourceDispatches: ResourceDispatch[] = [
  { id: "dispatch-1", event_id: "demo-event-1", resource_id: "res-vehicle-1", request_note: "支援象山路积水点排涝", status: "approved", requested_at: createdAt, approved_at: "2026-09-20T08:15:00+08:00", updated_at: "2026-09-20T08:15:00+08:00" },
];
export const demoInventoryBatches: InventoryBatch[] = [
  { id: "batch-pump-1", warehouse_id: "wh-district", item_id: "item-pump", batch_no: "2026-FX-001", supplier: "演示应急装备供应商", procurement_no: "CG-2026-018", quantity: 8, expires_at: "2027-06-30", created_at: createdAt },
];
export const demoInventoryStocktakes: InventoryStocktake[] = [];
export const demoReviewIssues: ReviewIssue[] = [
  { id: "review-issue-1", event_id: "demo-event-1", title: "低洼点视频覆盖不足", description: "现场态势主要依靠电话反馈，建议补充固定视频点位。", responsible_organization: "区城管局", due_at: "2026-10-20T18:00:00+08:00", status: "rectifying", verification_note: "", created_at: createdAt, updated_at: createdAt },
];
