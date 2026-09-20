import type { OperationalRecord, ProductModule, SourceMode } from "./types";

export type ProductPage =
  | "overview" | "portal" | "typhoon" | "plans" | "command" | "resources"
  | "inventory" | "risks" | "city" | "duty" | "data" | "reviews"
  | "logs" | "admin";

export const productPages: Array<{ key: ProductPage; label: string; group: string }> = [
  { key: "overview", label: "项目总览", group: "总览" },
  { key: "portal", label: "综合门户", group: "总览" },
  { key: "typhoon", label: "台汛卫士", group: "监测处置" },
  { key: "plans", label: "预案中心", group: "监测处置" },
  { key: "command", label: "指挥调度", group: "监测处置" },
  { key: "resources", label: "应急资源", group: "资源保障" },
  { key: "inventory", label: "物资库存", group: "资源保障" },
  { key: "risks", label: "风险普查", group: "数据治理" },
  { key: "city", label: "城市安全", group: "数据治理" },
  { key: "duty", label: "应急值班", group: "协同管理" },
  { key: "data", label: "数据管理", group: "协同管理" },
  { key: "reviews", label: "灾后复盘", group: "协同管理" },
  { key: "logs", label: "操作日志", group: "系统" },
  { key: "admin", label: "后台管理", group: "系统" },
];

export const moduleMeta: Record<ProductModule, { title: string; types: string[]; description: string }> = {
  plans: { title: "预案中心", types: ["预案模板", "专项预案", "事件预案"], description: "维护预案版本、匹配条件、响应等级和任务模板。" },
  resources: { title: "应急资源", types: ["救援队伍", "专家", "车辆", "装备", "医疗机构", "运输机构", "通信机构", "技术机构", "避难场所"], description: "统一维护队伍、人员、车辆、场所和保障机构。" },
  inventory: { title: "物资库存", types: ["仓库", "应急物资", "入库单", "出库单", "调拨单", "库存预警"], description: "覆盖入库、出库、调拨、盘点和库存预警。" },
  duty: { title: "应急值班", types: ["值班岗位", "排班记录", "值班日志", "交接班", "通讯录"], description: "维护排班、日志、交接和联络体系。" },
  monitoring: { title: "台汛卫士", types: ["雨情测站", "水情测站", "风情测站", "桥隧液位", "视频监控", "工情信息", "生命线工程", "气象预警"], description: "承载台汛监测、预警与响应；当前外部监测值为模拟数据。" },
  city_safety: { title: "城市安全综合监管", types: ["监管设备", "设备预警", "智慧预警", "驾驶舱指标"], description: "设备、预警和驾驶舱指标统一监管。" },
  reviews: { title: "灾后复盘", types: ["复盘报告", "改进措施", "演练评估"], description: "汇总事件时间线、任务完成情况、问题和改进措施。" },
  organizations: { title: "组织机构", types: ["区级部门", "镇街", "社区", "应急队伍", "工作群组"], description: "维护组织树和业务归属。" },
  integrations: { title: "接入管理", types: ["浙政钉", "IRS", "数据仓", "短信", "语音", "视频", "物联网", "气象"], description: "记录外部系统接入状态、责任人和联调边界。" },
  announcements: { title: "通知公告", types: ["通知", "公告", "文件"], description: "发布内部通知、公告和文件索引。" },
};

const now = "2026-09-19T08:00:00+08:00";
const make = (id: string, module: ProductModule, record_type: string, title: string, status: string, area: string, owner_org: string, summary: string, source_mode: SourceMode, details: OperationalRecord["details"]): OperationalRecord => ({
  id, module, record_type, title, status, area, owner_org, summary, source_mode, details, created_at: now, updated_at: now,
});

export const demoOperationalRecords: OperationalRecord[] = [
  make("op-plan-rain", "plans", "专项预案", "西湖区暴雨内涝应急处置预案", "已发布", "全区", "区应急管理局", "适用于短时强降雨、道路积水和人员转移场景。", "real", { eventType: "暴雨内涝", levels: ["II级", "III级", "IV级"], keywords: ["积水", "强降雨", "排涝", "转移"], tasks: ["排涝作业", "人员转移", "交通疏导"] }),
  make("op-plan-typhoon", "plans", "专项预案", "西湖区防台风应急预案", "已发布", "全区", "区应急管理局", "适用于台风、大风和沿湖高风险区域响应。", "real", { eventType: "台风", levels: ["I级", "II级", "III级"], keywords: ["台风", "大风", "转移"], tasks: ["巡查加固", "人员转移", "物资前置"] }),
  make("op-team-1", "resources", "救援队伍", "转塘街道综合应急队", "可调度", "转塘街道", "转塘街道", "24人，具备排涝与人员转移能力。", "real", { contact: "值班岗位A", phone: "演示号码", capacity: 24, longitude: 120.09, latitude: 30.16 }),
  make("op-expert-1", "resources", "专家", "地质灾害专家A", "可联络", "西湖区", "专家组", "专业方向：边坡与地质灾害。", "real", { specialty: "地质灾害", phone: "演示号码" }),
  make("op-shelter-1", "resources", "避难场所", "转塘演示安置点A", "可用", "转塘街道", "属地街道", "可容纳260人，具备基础生活保障。", "real", { capacity: 260, occupied: 0, address: "演示地址" }),
  make("op-warehouse-1", "inventory", "仓库", "三墩应急物资库", "正常", "三墩镇", "物资保障组", "区级综合应急物资仓库。", "real", { keeper: "仓库管理员", address: "演示地址" }),
  make("op-material-1", "inventory", "应急物资", "移动排涝泵", "库存正常", "三墩镇", "物资保障组", "当前库存6台，预警下限2台。", "real", { warehouse: "三墩应急物资库", unit: "台", quantity: 6, minimum: 2, maximum: 12 }),
  make("op-duty-1", "duty", "排班记录", "今日区级应急值班", "值班中", "西湖区", "区应急管理局", "主班、辅班和带班领导三级值守。", "real", { leader: "带班岗位A", primary: "主班岗位A", secondary: "辅班岗位A", shift: "08:30-次日08:30" }),
  make("op-rain-1", "monitoring", "雨情测站", "三墩雨量站", "正常", "三墩镇", "外部监测系统", "小时雨量12mm。", "simulated", { value: 12, unit: "mm/h", threshold: 30, updated: now }),
  make("op-water-1", "monitoring", "水情测站", "留下水位站", "关注", "留下街道", "外部监测系统", "水位4.2m，低于演示警戒值。", "simulated", { value: 4.2, unit: "m", threshold: 4.5, updated: now }),
  make("op-liquid-1", "monitoring", "桥隧液位", "转塘积水点", "超警", "转塘街道", "外部物联系统", "积水30cm，超过演示阈值20cm。", "simulated", { value: 30, unit: "cm", threshold: 20, updated: now }),
  make("op-device-1", "city_safety", "监管设备", "城市安全传感器A", "在线", "西湖区", "城市安全平台", "演示设备，最近心跳正常。", "simulated", { deviceType: "可燃气体", online: true, lastHeartbeat: now }),
  make("op-alert-1", "city_safety", "智慧预警", "地下空间气体浓度预警", "待处置", "西湖区", "城市安全平台", "演示阈值触发，等待人工复核。", "simulated", { level: "橙色", device: "城市安全传感器A", value: "演示值" }),
  make("op-review-1", "reviews", "复盘报告", "暴雨内涝演示事件复盘", "待完善", "转塘街道", "区应急管理局", "已形成时间线、任务完成率和两项改进措施。", "real", { event: "暴雨内涝演示事件", completionRate: 100, issues: ["外部回执待接入", "资源位置需动态更新"] }),
  make("op-org-1", "organizations", "区级部门", "西湖区应急管理局", "启用", "西湖区", "平台管理员", "平台主管部门。", "real", { code: "XH-YJ", parent: "" }),
  make("op-integration-dd", "integrations", "浙政钉", "浙政钉统一认证", "等待授权", "政务网", "平台管理员", "需要甲方提供应用标识、回调地址和联调环境。", "external", { required: ["应用标识", "密钥", "回调白名单", "测试账号"], acceptance: "完成单点登录、用户同步和退出联调" }),
  make("op-integration-irs", "integrations", "IRS", "省市IRS数据回流", "等待接口", "政务网", "数据管理组", "需要数据目录、接口授权和字段标准。", "external", { required: ["接口文档", "目录授权", "字段映射", "调用频率"], acceptance: "新增、变更、删减数据可派单并回写" }),
  make("op-integration-iot", "integrations", "物联网", "雨水风情与液位接入", "等待接口", "政务网", "监测预警组", "当前页面使用明确标注的模拟值。", "external", { required: ["测站编码", "实时接口", "阈值规则", "历史数据"], acceptance: "数据时效、告警和断线重连验证" }),
];

export const tenderCoverage = [
  ["一单位一平台", "统一门户、用户、授权、接入", "部分实现", "Supabase统一入口可用；浙政钉和三套旧系统等待授权"],
  ["台汛卫士", "监测、预警、值班、资源、数据管理、复盘", "核心闭环+模拟适配", "统一监测模型、阈值和告警处置可用；实时数据和旧系统迁移等待接口"],
  ["预案中心", "展示、匹配、响应、数字化、跟踪", "核心实现", "规则匹配、任务生成、资源关联和执行跟踪可用"],
  ["城市安全", "设备、预警、驾驶舱、移动端", "核心闭环+模拟适配", "设备在线率、趋势、地图和告警闭环可用；真实设备与浙政钉等待接口"],
  ["风险普查", "差异派单、确认、回写、下载", "核心实现", "闭环和导出可用；IRS与数据仓使用模拟适配器"],
] as const;
