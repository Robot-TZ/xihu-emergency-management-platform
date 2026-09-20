import type { EventRecord, RiskRecord, TaskRecord } from "./types";

export const demoEvent: EventRecord = {
  id: "demo-event-1",
  event_type: "暴雨内涝",
  response_level: "Ⅲ级",
  area: "转塘街道",
  happened_at: "2025-09-18T14:30:00+08:00",
  description: "短时强降雨导致道路积水约30厘米，需排涝并转移低洼区域人员。",
  address: "转塘街道象山路与美院南街交叉口",
  longitude: 120.078,
  latitude: 30.159,
  status: "处置中",
  created_at: "2025-09-18T14:30:00+08:00",
};

export const demoTasks: TaskRecord[] = [
  ["排涝作业", "镇街应急队", "排涝泵2台", 20],
  ["低洼区域人员转移", "社区工作组", "转运车辆1辆", 30],
  ["现场交通疏导", "协同保障组", "警示设施10套", 15],
].map((item, index) => ({
  id: `demo-task-${index + 1}`,
  event_id: demoEvent.id,
  title: String(item[0]),
  assignee: String(item[1]),
  resource: String(item[2]),
  due_minutes: Number(item[3]),
  status: "待查阅",
  created_at: demoEvent.created_at,
}));

export const demoRisks: RiskRecord[] = [
  ["转塘演示安置点A", "转塘街道", "避灾安置场所", "区级部门", "变更", "容纳200人", "容纳260人", "待确认"],
  ["三墩演示物资库B", "三墩镇", "应急物资库", "IRS回流", "新增", "无记录", "库房面积180㎡", "待派单"],
  ["留下演示安置点C", "留下街道", "避灾安置场所", "部门核报", "删减", "原在用安置点", "已删除", "待确认"],
].map((item, index) => ({
  id: `demo-risk-${index + 1}`,
  name: String(item[0]), area: String(item[1]), record_type: String(item[2]),
  source: String(item[3]), change_type: item[4] as RiskRecord["change_type"],
  old_value: String(item[5]), new_value: String(item[6]),
  status: item[7] as RiskRecord["status"], created_at: demoEvent.created_at,
  longitude: 120.07 + index * 0.03,
  latitude: 30.16 + index * 0.025,
}));
