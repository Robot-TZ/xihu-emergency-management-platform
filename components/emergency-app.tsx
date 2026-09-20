"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { urlForPage } from "@/lib/product-routing";
import { demoEvent, demoRisks, demoTasks } from "@/lib/demo-data";
import { demoPlans, demoPlanTaskTemplates, demoPlanVersions } from "@/lib/plan-demo";
import { parseTaskTemplates } from "@/lib/plan-engine";
import { demoInventoryBalances, demoInventoryDocumentLines, demoInventoryDocuments, demoInventoryMovements, demoInventoryItems, demoResources, demoRiskBatches, demoRiskFieldChanges, demoRiskWritebackJobs, demoWarehouses } from "@/lib/operations-demo";
import { demoMonitoringActions, demoMonitoringAlerts, demoMonitoringAssets, demoMonitoringReadings, demoMonitoringRules } from "@/lib/monitoring-demo";
import { alertFingerprint, evaluateMonitoringRule } from "@/lib/monitoring-engine";
import { applyInventoryDeltas } from "@/lib/resource-engine";
import { downloadCsv, downloadWorkbook, readWorkbook, type SheetRow } from "@/lib/spreadsheet";
import { demoOperationalRecords, moduleMeta, productPages, type ProductPage } from "@/lib/product-catalog";
import type { ActivityLog, EmergencyPlan, EventRecord, InventoryBalance, InventoryDocument, InventoryDocumentLine, InventoryItem, InventoryMovement, MonitoringAlert, MonitoringAlertAction, MonitoringAsset, MonitoringDomain, MonitoringReading, MonitoringRule, OperationalRecord, Organization, OrganizationMember, PlanTaskTemplate, PlanVersion, ProductModule, Profile, ResourceAsset, RiskFieldChange, RiskImportBatch, RiskRecord, RiskWritebackJob, Role, TaskRecord, TeamInvite, Warehouse } from "@/lib/types";
import { DataPage, LogsPage, OverviewPage, PortalPage } from "./product-pages";
import { LogoMark } from "./logo-mark";
import { AdminPage, CommandPage } from "./workflow-pages";
import { PlanCenterPage, type PlanLifecycleAction } from "./plan-center";
import { InventoryCenterPage, ResourceCenterPage } from "./resource-inventory-center";
import { RiskSurveyCenterPage } from "./risk-survey-center";
import { MonitoringCenterPage } from "./monitoring-center";
import { DutyCenterPage, EventContextBar, ReviewCenterPage } from "./experience-center";

export type ProductSnapshot = {
  events: EventRecord[]; tasks: TaskRecord[]; risks: RiskRecord[]; logs: ActivityLog[]; records: OperationalRecord[];
  plans: EmergencyPlan[]; planVersions: PlanVersion[]; planTemplates: PlanTaskTemplate[];
  resources: ResourceAsset[]; warehouses: Warehouse[]; inventoryItems: InventoryItem[]; inventoryBalances: InventoryBalance[];
  inventoryDocuments: InventoryDocument[]; inventoryDocumentLines: InventoryDocumentLine[]; inventoryMovements: InventoryMovement[];
  riskBatches: RiskImportBatch[]; riskChanges: RiskFieldChange[]; riskWritebackJobs: RiskWritebackJob[];
  monitoringAssets: MonitoringAsset[]; monitoringReadings: MonitoringReading[]; monitoringRules: MonitoringRule[];
  monitoringAlerts: MonitoringAlert[]; monitoringActions: MonitoringAlertAction[];
};
const empty: ProductSnapshot = { events: [], tasks: [], risks: [], logs: [], records: [], plans: [], planVersions: [], planTemplates: [], resources: [], warehouses: [], inventoryItems: [], inventoryBalances: [], inventoryDocuments: [], inventoryDocumentLines: [], inventoryMovements: [], riskBatches: [], riskChanges: [], riskWritebackJobs: [], monitoringAssets: [], monitoringReadings: [], monitoringRules: [], monitoringAlerts: [], monitoringActions: [] };
const LOCAL_KEY = "xihu-emergency-product-v2";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const canWrite = (role: Role) => role === "member" || role === "admin";
async function hashInviteCode(code: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.trim()));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function forInsert<T extends object>(record: T): Omit<T, "id" | "created_at" | "updated_at"> {
  const payload = { ...record } as T & { id?: unknown; created_at?: unknown; updated_at?: unknown };
  delete payload.id; delete payload.created_at; delete payload.updated_at;
  return payload;
}
function sheetCell(row: SheetRow, ...keys: string[]) {
  const key = keys.find((candidate) => row[candidate] !== undefined);
  return key ? String(row[key] ?? "").trim() : "";
}

function isSnapshot(value: unknown): value is ProductSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ProductSnapshot>;
  return Array.isArray(data.events) && Array.isArray(data.tasks) && Array.isArray(data.risks) && Array.isArray(data.logs);
}
function loadLocal(): ProductSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") as unknown;
    if (isSnapshot(parsed)) return {
      ...parsed,
      records: Array.isArray(parsed.records) ? parsed.records : demoOperationalRecords,
      plans: Array.isArray(parsed.plans) ? parsed.plans : demoPlans,
      planVersions: Array.isArray(parsed.planVersions) ? parsed.planVersions : demoPlanVersions,
      planTemplates: Array.isArray(parsed.planTemplates) ? parsed.planTemplates : demoPlanTaskTemplates,
      resources: Array.isArray(parsed.resources) ? parsed.resources : demoResources,
      warehouses: Array.isArray(parsed.warehouses) ? parsed.warehouses : demoWarehouses,
      inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : demoInventoryItems,
      inventoryBalances: Array.isArray(parsed.inventoryBalances) ? parsed.inventoryBalances : demoInventoryBalances,
      inventoryDocuments: Array.isArray(parsed.inventoryDocuments) ? parsed.inventoryDocuments : demoInventoryDocuments,
      inventoryDocumentLines: Array.isArray(parsed.inventoryDocumentLines) ? parsed.inventoryDocumentLines : demoInventoryDocumentLines,
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : demoInventoryMovements,
      riskBatches: Array.isArray(parsed.riskBatches) ? parsed.riskBatches : demoRiskBatches,
      riskChanges: Array.isArray(parsed.riskChanges) ? parsed.riskChanges : demoRiskFieldChanges,
      riskWritebackJobs: Array.isArray(parsed.riskWritebackJobs) ? parsed.riskWritebackJobs : demoRiskWritebackJobs,
      monitoringAssets: Array.isArray(parsed.monitoringAssets) ? parsed.monitoringAssets : demoMonitoringAssets,
      monitoringReadings: Array.isArray(parsed.monitoringReadings) ? parsed.monitoringReadings : demoMonitoringReadings,
      monitoringRules: Array.isArray(parsed.monitoringRules) ? parsed.monitoringRules : demoMonitoringRules,
      monitoringAlerts: Array.isArray(parsed.monitoringAlerts) ? parsed.monitoringAlerts : demoMonitoringAlerts,
      monitoringActions: Array.isArray(parsed.monitoringActions) ? parsed.monitoringActions : demoMonitoringActions,
    };
  } catch { /* corrupted visitor data falls back to safe defaults */ }
  return { ...empty, records: demoOperationalRecords, plans: demoPlans, planVersions: demoPlanVersions, planTemplates: demoPlanTaskTemplates, resources: demoResources, warehouses: demoWarehouses, inventoryItems: demoInventoryItems, inventoryBalances: demoInventoryBalances, inventoryDocuments: demoInventoryDocuments, inventoryDocumentLines: demoInventoryDocumentLines, inventoryMovements: demoInventoryMovements, riskBatches: demoRiskBatches, riskChanges: demoRiskFieldChanges, riskWritebackJobs: demoRiskWritebackJobs, monitoringAssets: demoMonitoringAssets, monitoringReadings: demoMonitoringReadings, monitoringRules: demoMonitoringRules, monitoringAlerts: demoMonitoringAlerts, monitoringActions: demoMonitoringActions };
}
function withLocalLog(data: ProductSnapshot, action: string, entity_type: string, detail: Record<string, unknown> = {}): ProductSnapshot {
  return { ...data, logs: [{ id: uid(), action, entity_type, detail, created_at: now() }, ...data.logs] };
}

export function EmergencyApp({ initialPage = "portal", initialEventId, allowGuestDemo = false }: { initialPage?: ProductPage; initialEventId?: string; allowGuestDemo?: boolean }) {
  const [page, setPage] = useState<ProductPage>(initialPage);
  const [data, setData] = useState<ProductSnapshot>(empty);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("member");
  const [accountActive, setAccountActive] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [newInviteCode, setNewInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState(initialEventId || "");
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig()) { if (allowGuestDemo) setData(loadLocal()); setLoading(false); return; }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const current = auth.user;
    setUser(current);
    if (!current) {
      if (!allowGuestDemo) { window.location.assign(urlForPage("portal", window.location.hostname)); return; }
      setData(loadLocal()); setRole("member"); setAccountActive(true); setProfiles([]); setOrganizations([]); setMemberships([]); setInvites([]); setLoading(false); return;
    }
    const profileResult = await supabase.from("profiles").select("id,email,display_name,role,organization,job_title,active,created_at").eq("id", current.id).maybeSingle();
    if (!profileResult.data) await supabase.from("profiles").insert({ id: current.id, email: current.email, role: "viewer" });
    const currentRole = (profileResult.data?.role || "viewer") as Role;
    const currentActive = profileResult.data?.active !== false;
    setRole(currentRole);
    setAccountActive(currentActive);
    const [events, tasks, risks, logs, records, plans, planVersions, planTemplates, resources, warehouses, inventoryItems, inventoryBalances, inventoryDocuments, inventoryDocumentLines, inventoryMovements, riskBatches, riskChanges, riskWritebackJobs, monitoringAssets, monitoringReadings, monitoringRules, monitoringAlerts, monitoringActions, orgs, orgMembers, visibleProfiles] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("risk_records").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("operational_records").select("*").order("created_at", { ascending: false }),
      supabase.from("emergency_plans").select("*").order("updated_at", { ascending: false }),
      supabase.from("plan_versions").select("*").order("version_no", { ascending: false }),
      supabase.from("plan_task_templates").select("*").order("sort_order"),
      supabase.from("resource_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("warehouses").select("*").order("name"),
      supabase.from("inventory_items").select("*").order("name"),
      supabase.from("inventory_balances").select("*").order("updated_at", { ascending: false }),
      supabase.from("inventory_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_document_lines").select("*").order("created_at"),
      supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }),
      supabase.from("risk_import_batches").select("*").order("created_at", { ascending: false }),
      supabase.from("risk_field_changes").select("*").order("created_at"),
      supabase.from("risk_writeback_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("monitoring_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("monitoring_readings").select("*").order("measured_at", { ascending: false }).limit(1000),
      supabase.from("monitoring_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("monitoring_alerts").select("*").order("last_triggered_at", { ascending: false }),
      supabase.from("monitoring_alert_actions").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("organizations").select("*").order("name"),
      supabase.from("organization_members").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email,display_name,role,organization,job_title,active,created_at").order("created_at", { ascending: false }),
    ]);
    const failure = [events, tasks, risks, logs, records, plans, planVersions, planTemplates, resources, warehouses, inventoryItems, inventoryBalances, inventoryDocuments, inventoryDocumentLines, inventoryMovements, riskBatches, riskChanges, riskWritebackJobs, monitoringAssets, monitoringReadings, monitoringRules, monitoringAlerts, monitoringActions, orgs, orgMembers, visibleProfiles].find((result) => result.error)?.error;
    if (failure) setNotice("数据读取失败：" + failure.message);
    setData({ events: (events.data || []) as EventRecord[], tasks: (tasks.data || []) as TaskRecord[], risks: (risks.data || []) as RiskRecord[], logs: (logs.data || []) as ActivityLog[], records: (records.data || []) as OperationalRecord[], plans: (plans.data || []) as EmergencyPlan[], planVersions: (planVersions.data || []) as PlanVersion[], planTemplates: (planTemplates.data || []) as PlanTaskTemplate[], resources: (resources.data || []) as ResourceAsset[], warehouses: (warehouses.data || []) as Warehouse[], inventoryItems: (inventoryItems.data || []) as InventoryItem[], inventoryBalances: (inventoryBalances.data || []) as InventoryBalance[], inventoryDocuments: (inventoryDocuments.data || []) as InventoryDocument[], inventoryDocumentLines: (inventoryDocumentLines.data || []) as InventoryDocumentLine[], inventoryMovements: (inventoryMovements.data || []) as InventoryMovement[], riskBatches: (riskBatches.data || []) as RiskImportBatch[], riskChanges: (riskChanges.data || []) as RiskFieldChange[], riskWritebackJobs: (riskWritebackJobs.data || []) as RiskWritebackJob[], monitoringAssets: (monitoringAssets.data || []) as MonitoringAsset[], monitoringReadings: (monitoringReadings.data || []) as MonitoringReading[], monitoringRules: (monitoringRules.data || []) as MonitoringRule[], monitoringAlerts: (monitoringAlerts.data || []) as MonitoringAlert[], monitoringActions: (monitoringActions.data || []) as MonitoringAlertAction[] });
    setOrganizations((orgs.data || []) as Organization[]);
    setMemberships((orgMembers.data || []) as OrganizationMember[]);
    setProfiles((visibleProfiles.data || []) as Profile[]);
    if (currentRole === "admin") {
      const inviteRows = await supabase.from("team_invites").select("id,label,role,active,max_uses,uses,expires_at,organization_id,created_at").order("created_at", { ascending: false });
      setInvites((inviteRows.data || []) as TeamInvite[]);
    }
    setLoading(false);
  }, [allowGuestDemo]);

  useEffect(() => {
    queueMicrotask(() => void load());
    if (!hasSupabaseConfig()) return;
    const { data: listener } = createClient().auth.onAuthStateChange(() => void load());
    return () => listener.subscription.unsubscribe();
  }, [load]);
  useEffect(() => { if (allowGuestDemo && !user && !loading) localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }, [allowGuestDemo, data, user, loading]);

  function navigate(nextPage: ProductPage, eventId: string = activeEventId) {
    setSidebarOpen(false);
    setActiveEventId(eventId);
    const target = urlForPage(nextPage, window.location.hostname, eventId || null);
    if (target.startsWith("/?view=")) {
      setPage(nextPage);
      window.history.replaceState(null, "", allowGuestDemo ? `${target}&demo=1` : target);
    }
    else window.location.assign(target);
  }

  function requireWrite() { if (!accountActive) { setNotice("账号已停用，请联系管理员。"); return false; } if (!canWrite(role)) { setNotice("当前角色为只读角色。"); return false; } return true; }
  function confirmAction(message: string) { return typeof window !== "undefined" && window.confirm(message); }
  async function audit(action: string, entity_type: string, entity_id?: string, detail: Record<string, unknown> = {}) {
    if (user) await createClient().from("activity_logs").insert({ user_id: user.id, action, entity_type, entity_id: entity_id && /^[0-9a-f-]{36}$/.test(entity_id) ? entity_id : null, detail });
  }

  async function seed() {
    if (!requireWrite()) return;
    if (!user) { setData(withLocalLog({ events: [demoEvent], tasks: demoTasks, risks: demoRisks, logs: [], records: demoOperationalRecords, plans: demoPlans, planVersions: demoPlanVersions, planTemplates: demoPlanTaskTemplates, resources: demoResources, warehouses: demoWarehouses, inventoryItems: demoInventoryItems, inventoryBalances: demoInventoryBalances, inventoryDocuments: [], inventoryDocumentLines: [], inventoryMovements: [], riskBatches: demoRiskBatches, riskChanges: demoRiskFieldChanges, riskWritebackJobs: [], monitoringAssets: demoMonitoringAssets, monitoringReadings: demoMonitoringReadings, monitoringRules: demoMonitoringRules, monitoringAlerts: demoMonitoringAlerts, monitoringActions: demoMonitoringActions }, "初始化产品数据", "workspace")); setNotice("示例数据已保存到本机。"); return; }
    const supabase = createClient();
    if (!data.events.length) await supabase.from("events").insert({ ...forInsert(demoEvent), user_id: user.id });
    if (!data.records.length) await supabase.from("operational_records").insert(demoOperationalRecords.map((record) => ({ ...forInsert(record), user_id: user.id })));
    if (!data.monitoringAssets.length) {
      const assetRows = demoMonitoringAssets.map((asset) => ({ ...forInsert(asset), user_id: user.id }));
      const createdAssets = await supabase.from("monitoring_assets").upsert(assetRows, { onConflict: "code" }).select("id,code");
      if (createdAssets.error) return setNotice(createdAssets.error.message);
      const ruleRows = demoMonitoringRules.map((rule) => ({ ...forInsert(rule), user_id: user.id }));
      const createdRules = await supabase.from("monitoring_rules").upsert(ruleRows, { onConflict: "domain,asset_type,metric_code,name" });
      if (createdRules.error) return setNotice(createdRules.error.message);
      const assetIdByDemoId = new Map(demoMonitoringAssets.map((asset) => [asset.id, createdAssets.data.find((item) => item.code === asset.code)?.id]));
      for (const reading of demoMonitoringReadings) {
        const assetId = assetIdByDemoId.get(reading.asset_id); if (!assetId) continue;
        const result = await supabase.rpc("ingest_monitoring_reading", { p_asset_id: assetId, p_metric_code: reading.metric_code, p_value: reading.value, p_unit: reading.unit, p_measured_at: reading.measured_at, p_raw_payload: reading.raw_payload || {} });
        if (result.error) return setNotice(result.error.message);
      }
    }
    await audit("初始化第二阶段产品数据", "workspace"); await load(); setNotice("产品基础数据已写入 Supabase。");
  }

  async function addEvent(form: FormData) {
    if (!requireWrite()) return;
    const record: EventRecord = { id: uid(), event_type: String(form.get("type")), response_level: String(form.get("level")), area: String(form.get("area")), happened_at: now(), description: String(form.get("description")), status: "待研判", created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, events: [record, ...current.events] }, "新增事件", "event", { area: record.area }));
    else { const { error } = await createClient().from("events").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增事件", "event", undefined, { area: record.area }); await load(); }
    setNotice("事件已保存。");
  }
  async function progressEvent(event: EventRecord) {
    if (!requireWrite()) return;
    const status = event.status === "待研判" ? "已研判" : event.status === "已研判" ? "处置中" : "已结案";
    if (status === "已结案" && data.tasks.some((item) => item.event_id === event.id && item.status !== "已完成")) return setNotice("仍有未完成任务，不能结案。请先完成任务或记录异常处置结果。");
    if (status === "已结案" && !confirmAction("确认所有处置结果均已复核，并将该事件结案？")) return;
    if (!user) setData((current) => withLocalLog({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, status } : item) }, "推进事件", "event", { status }));
    else { const { error } = await createClient().from("events").update({ status, updated_at: now() }).eq("id", event.id); if (error) return setNotice(error.message); await audit("推进事件", "event", event.id, { status }); await load(); }
  }
  async function removeEvent(eventId: string) {
    if (!requireWrite()) return;
    const linkedTasks = data.tasks.filter((item) => item.event_id === eventId);
    if (linkedTasks.length) return setNotice(`该事件关联 ${linkedTasks.length} 条任务，不能直接删除。请保留审计记录并通过结案关闭。`);
    if (!confirmAction("删除后无法恢复，确认删除这个未关联任务的事件？")) return;
    if (!user) setData((current) => withLocalLog({ ...current, events: current.events.filter((item) => item.id !== eventId), tasks: current.tasks.filter((item) => item.event_id !== eventId) }, "删除事件", "event"));
    else { const { error } = await createClient().from("events").delete().eq("id", eventId); if (error) return setNotice(error.message); await audit("删除事件", "event", eventId); await load(); }
  }

  async function addTask(form: FormData, eventId?: string, planId?: string) {
    if (!requireWrite()) return;
    const assigneeUserId = String(form.get("assigneeUserId") || "") || null;
    const assigneeOrganizationId = String(form.get("assigneeOrganizationId") || "") || null;
    if (assigneeUserId && assigneeOrganizationId) return setNotice("接收人与接收组织只能选择一项。");
    const targetUser = profiles.find((item) => item.id === assigneeUserId);
    const targetOrg = organizations.find((item) => item.id === assigneeOrganizationId);
    const assignee = targetUser?.display_name || targetUser?.email || targetOrg?.name || String(form.get("assignee") || "未指定");
    const record: TaskRecord = { id: uid(), event_id: eventId || null, plan_id: planId || null, title: String(form.get("title")), assignee, assignee_user_id: assigneeUserId, assignee_organization_id: assigneeOrganizationId, resource: String(form.get("resource") || ""), channel: String(form.get("channel") || "平台内"), status: "待查阅", due_minutes: Number(form.get("due") || 30), created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, tasks: [record, ...current.tasks] }, "新增指令任务", "task"));
    else { const { error } = await createClient().from("tasks").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增指令任务", "task"); await load(); }
  }
  async function progressTask(task: TaskRecord) {
    if (!requireWrite()) return;
    const status = task.status === "待查阅" ? "已读" : task.status === "已读" ? "已反馈" : "已完成";
    const timing = status === "已读" ? { read_at: now() } : status === "已反馈" ? { feedback_at: now(), feedback: "已提交现场反馈" } : { completed_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status, ...timing } : item) }, "推进指令任务", "task", { status }));
    else { const { error } = await createClient().from("tasks").update({ status, ...timing, updated_at: now() }).eq("id", task.id); if (error) return setNotice(error.message); await audit("推进指令任务", "task", task.id, { status }); await load(); }
  }
  async function removeTask(taskId: string) {
    if (!requireWrite()) return;
    if (!confirmAction("删除任务会移除处置记录。正式业务建议保留并完成或关闭，仍要删除吗？")) return;
    if (!user) setData((current) => withLocalLog({ ...current, tasks: current.tasks.filter((item) => item.id !== taskId) }, "删除指令任务", "task"));
    else { const { error } = await createClient().from("tasks").delete().eq("id", taskId); if (error) return setNotice(error.message); await audit("删除指令任务", "task", taskId); await load(); }
  }
  async function addPlan(form: FormData) {
    if (!requireWrite()) return;
    const typeWeight = Number(form.get("typeWeight") || 50);
    const levelWeight = Number(form.get("levelWeight") || 30);
    const keywordWeight = Number(form.get("keywordWeight") || 20);
    if (typeWeight + levelWeight + keywordWeight !== 100) return setNotice("三项匹配权重之和必须为 100。");
    const createdAt = now(); const planId = uid(); const versionId = uid();
    const plan: EmergencyPlan = { id: planId, code: String(form.get("code")).trim().toUpperCase(), title: String(form.get("title")), event_type: String(form.get("eventType")), area: String(form.get("area") || "全区"), status: "draft", current_version_id: null, created_at: createdAt, updated_at: createdAt };
    const version: PlanVersion = { id: versionId, plan_id: planId, version_no: 1, status: "draft", summary: String(form.get("summary")), content: String(form.get("content")), response_levels: String(form.get("levels") || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), keywords: String(form.get("keywords") || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), type_weight: typeWeight, level_weight: levelWeight, keyword_weight: keywordWeight, created_at: createdAt, updated_at: createdAt };
    const templates = parseTaskTemplates(String(form.get("tasks") || ""), versionId, uid, createdAt);
    if (!templates.length) return setNotice("至少需要一条任务模板。");
    if (!user) {
      setData((current) => withLocalLog({ ...current, plans: [plan, ...current.plans], planVersions: [version, ...current.planVersions], planTemplates: [...templates, ...current.planTemplates] }, "创建预案草稿", "emergency_plan", { code: plan.code }));
    } else {
      const supabase = createClient();
      const planResult = await supabase.from("emergency_plans").insert({ ...forInsert(plan), user_id: user.id }).select("id").single();
      if (planResult.error) return setNotice(planResult.error.message);
      const remotePlanId = planResult.data.id; const remoteVersionId = uid();
      const versionResult = await supabase.from("plan_versions").insert({ ...forInsert({ ...version, id: remoteVersionId, plan_id: remotePlanId }) }).select("id").single();
      if (versionResult.error) { await supabase.from("emergency_plans").delete().eq("id", remotePlanId); return setNotice(versionResult.error.message); }
      const templateResult = await supabase.from("plan_task_templates").insert(templates.map((item) => ({ ...forInsert(item), version_id: versionResult.data.id })));
      if (templateResult.error) { await supabase.from("emergency_plans").delete().eq("id", remotePlanId); return setNotice(templateResult.error.message); }
      await audit("创建预案草稿", "emergency_plan", remotePlanId, { code: plan.code }); await load();
    }
    setNotice("预案草稿、V1 版本和任务模板已创建。");
  }

  async function transitionPlan(plan: EmergencyPlan, version: PlanVersion, action: PlanLifecycleAction) {
    if (!requireWrite()) return;
    if ((action === "publish" || action === "retire") && role !== "admin") return setNotice("审核发布和作废只允许管理员操作。");
    if (action === "retire" && !confirmAction("作废后该预案将不再参与事件匹配，但历史版本与审计记录会保留。确认作废？")) return;
    const versionTemplates = data.planTemplates.filter((item) => item.version_id === version.id).sort((a, b) => a.sort_order - b.sort_order);
    const createdAt = now();
    if (!user) {
      setData((current) => {
        if (action === "copy") {
          const newVersionId = uid();
          const newVersion: PlanVersion = { ...version, id: newVersionId, version_no: Math.max(...current.planVersions.filter((item) => item.plan_id === plan.id).map((item) => item.version_no), 0) + 1, status: "draft", submitted_at: null, published_at: null, created_at: createdAt, updated_at: createdAt };
          const newTemplates = versionTemplates.map((item, index) => ({ ...item, id: uid(), version_id: newVersionId, sort_order: index + 1, created_at: createdAt }));
          return withLocalLog({ ...current, planVersions: [newVersion, ...current.planVersions], planTemplates: [...newTemplates, ...current.planTemplates] }, "复制预案新版本", "plan_version", { version: newVersion.version_no });
        }
        const nextVersionStatus = action === "submit" ? "review" : action === "publish" ? "published" : version.status;
        const nextPlanStatus = action === "submit" && !plan.current_version_id ? "review" : action === "publish" ? "published" : action === "retire" ? "retired" : plan.status;
        return withLocalLog({ ...current,
          plans: current.plans.map((item) => item.id === plan.id ? { ...item, status: nextPlanStatus, current_version_id: action === "publish" ? version.id : item.current_version_id, updated_at: createdAt } : item),
          planVersions: current.planVersions.map((item) => item.plan_id === plan.id && action === "publish" && item.status === "published" ? { ...item, status: "archived" } : item.id === version.id ? { ...item, status: nextVersionStatus, submitted_at: action === "submit" ? createdAt : item.submitted_at, published_at: action === "publish" ? createdAt : item.published_at, updated_at: createdAt } : item),
        }, action === "submit" ? "预案版本送审" : action === "publish" ? "审核发布预案" : "作废预案", "emergency_plan");
      });
    } else {
      const supabase = createClient();
      if (action === "copy") {
        const nextVersionNo = Math.max(...data.planVersions.filter((item) => item.plan_id === plan.id).map((item) => item.version_no), 0) + 1;
        const copied = await supabase.from("plan_versions").insert({ plan_id: plan.id, version_no: nextVersionNo, status: "draft", summary: version.summary, content: version.content, response_levels: version.response_levels, keywords: version.keywords, type_weight: version.type_weight, level_weight: version.level_weight, keyword_weight: version.keyword_weight }).select("id").single();
        if (copied.error) return setNotice(copied.error.message);
        const copiedTasks = await supabase.from("plan_task_templates").insert(versionTemplates.map((item) => ({ version_id: copied.data.id, title: item.title, assignee_role: item.assignee_role, resource_requirement: item.resource_requirement, due_minutes: item.due_minutes, sort_order: item.sort_order })));
        if (copiedTasks.error) return setNotice(copiedTasks.error.message);
      } else if (action === "submit") {
        const result = await supabase.from("plan_versions").update({ status: "review", submitted_at: createdAt, updated_at: createdAt }).eq("id", version.id); if (result.error) return setNotice(result.error.message);
        if (!plan.current_version_id) await supabase.from("emergency_plans").update({ status: "review", updated_at: createdAt }).eq("id", plan.id);
      } else if (action === "publish") {
        const archive = await supabase.from("plan_versions").update({ status: "archived", updated_at: createdAt }).eq("plan_id", plan.id).eq("status", "published"); if (archive.error) return setNotice(archive.error.message);
        const publish = await supabase.from("plan_versions").update({ status: "published", published_at: createdAt, updated_at: createdAt }).eq("id", version.id); if (publish.error) return setNotice(publish.error.message);
        const updatePlan = await supabase.from("emergency_plans").update({ status: "published", current_version_id: version.id, updated_at: createdAt }).eq("id", plan.id); if (updatePlan.error) return setNotice(updatePlan.error.message);
      } else {
        const result = await supabase.from("emergency_plans").update({ status: "retired", updated_at: createdAt }).eq("id", plan.id); if (result.error) return setNotice(result.error.message);
      }
      await audit(action === "submit" ? "预案版本送审" : action === "publish" ? "审核发布预案" : action === "copy" ? "复制预案新版本" : "作废预案", "emergency_plan", plan.id, { version: version.version_no }); await load();
    }
    setNotice(action === "submit" ? "已送审，等待管理员审核。" : action === "publish" ? "新版本已发布，旧版本已归档。" : action === "copy" ? "已复制为新草稿版本。" : "预案已作废。");
  }

  async function removePlan(plan: EmergencyPlan) {
    if (!requireWrite()) return;
    if (plan.status !== "draft") return setNotice("非草稿预案不得直接删除，请使用“作废”保留版本和审计记录。");
    if (!confirmAction("确认删除该草稿及其全部版本和任务模板？此操作无法恢复。")) return;
    if (!user) setData((current) => { const versionIds = current.planVersions.filter((item) => item.plan_id === plan.id).map((item) => item.id); return withLocalLog({ ...current, plans: current.plans.filter((item) => item.id !== plan.id), planVersions: current.planVersions.filter((item) => item.plan_id !== plan.id), planTemplates: current.planTemplates.filter((item) => !versionIds.includes(item.version_id)) }, "删除预案", "emergency_plan"); });
    else { const { error } = await createClient().from("emergency_plans").delete().eq("id", plan.id); if (error) return setNotice(error.message); await audit("删除预案", "emergency_plan", plan.id); await load(); }
    setNotice("预案及其版本和任务模板已删除。");
  }

  async function startPlan(event: EventRecord, plan: EmergencyPlan, version: PlanVersion, templates: PlanTaskTemplate[]) {
    if (!requireWrite()) return;
    const tasks = templates.map((template): TaskRecord => ({ id: uid(), event_id: event.id, emergency_plan_id: plan.id, plan_version_id: version.id, title: template.title, assignee: template.assignee_role, resource: template.resource_requirement, channel: user ? "平台内" : "平台内（模拟发送）", status: "待查阅", due_minutes: template.due_minutes, created_at: now() }));
    if (!user) setData((current) => withLocalLog({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, emergency_plan_id: plan.id, plan_version_id: version.id, status: "处置中" } : item), tasks: [...tasks, ...current.tasks] }, "启动预案版本并生成指令", "emergency_plan", { plan: plan.title, version: version.version_no }));
    else {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").insert(tasks.map((task) => ({ ...forInsert(task), user_id: user.id })));
      if (error) return setNotice(error.message);
      const eventUpdate = await supabase.from("events").update({ emergency_plan_id: plan.id, plan_version_id: version.id, status: "处置中", updated_at: now() }).eq("id", event.id);
      if (eventUpdate.error) return setNotice(eventUpdate.error.message);
      await audit("启动预案版本并生成指令", "emergency_plan", plan.id, { event: event.id, version: version.version_no }); await load();
    }
    navigate("command", event.id); setNotice(`已启动《${plan.title}》V${version.version_no}，并按模板生成 ${tasks.length} 条指令。`);
  }

  async function addResource(form: FormData) {
    if (!requireWrite()) return;
    const record: ResourceAsset = { id: uid(), code: String(form.get("code")).trim().toUpperCase(), name: String(form.get("name")), asset_type: String(form.get("assetType")) as ResourceAsset["asset_type"], area: String(form.get("area") || "全区"), address: String(form.get("address") || ""), contact_name: String(form.get("contactName") || ""), contact_phone: String(form.get("contactPhone") || ""), capabilities: String(form.get("capabilities") || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), capacity: Number(form.get("capacity") || 0), status: "available", maintenance_due_at: String(form.get("maintenanceDueAt") || "") || null, created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, resources: [record, ...current.resources] }, "新增应急资源", "resource_asset", { code: record.code }));
    else { const { error } = await createClient().from("resource_assets").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增应急资源", "resource_asset", undefined, { code: record.code }); await load(); }
    setNotice("应急资源已保存。");
  }
  async function updateResourceStatus(resource: ResourceAsset, status: ResourceAsset["status"]) {
    if (!requireWrite()) return;
    if (!user) setData((current) => withLocalLog({ ...current, resources: current.resources.map((item) => item.id === resource.id ? { ...item, status, updated_at: now() } : item) }, "更新资源状态", "resource_asset", { status }));
    else { const { error } = await createClient().from("resource_assets").update({ status, updated_at: now() }).eq("id", resource.id); if (error) return setNotice(error.message); await audit("更新资源状态", "resource_asset", resource.id, { status }); await load(); }
  }
  async function importResources(file?: File) {
    if (!file || !requireWrite()) return;
    try {
      const rows = await readWorkbook(file);
      const records = rows.map((row): ResourceAsset => ({ id: uid(), code: sheetCell(row, "编码", "code").toUpperCase(), name: sheetCell(row, "名称", "name"), asset_type: (sheetCell(row, "类型", "asset_type") || "equipment") as ResourceAsset["asset_type"], area: sheetCell(row, "区域", "area") || "全区", address: sheetCell(row, "地址", "address"), contact_name: sheetCell(row, "联系人", "contact_name"), contact_phone: sheetCell(row, "电话", "contact_phone"), capabilities: sheetCell(row, "保障能力", "capabilities").split(/[,，]/).filter(Boolean), capacity: Number(sheetCell(row, "能力值", "capacity") || 1), status: "available", maintenance_due_at: sheetCell(row, "维保到期", "maintenance_due_at") || null, created_at: now() })).filter((item) => item.code && item.name);
      if (!records.length) throw new Error("未识别到有效资源行");
      if (!user) setData((current) => withLocalLog({ ...current, resources: [...records, ...current.resources] }, "Excel导入应急资源", "resource_asset", { count: records.length }));
      else { const { error } = await createClient().from("resource_assets").upsert(records.map((record) => ({ ...forInsert(record), user_id: user.id })), { onConflict: "code" }); if (error) throw error; await audit("Excel导入应急资源", "resource_asset", undefined, { count: records.length }); await load(); }
      setNotice(`已导入 ${records.length} 条应急资源。`);
    } catch (error) { setNotice(`资源导入失败：${error instanceof Error ? error.message : "文件格式不正确"}`); }
  }
  async function exportResources() { await downloadWorkbook("应急资源台账.xlsx", "应急资源", data.resources.map((item) => ({ "编码": item.code, "名称": item.name, "类型": item.asset_type, "区域": item.area, "地址": item.address, "联系人": item.contact_name, "电话": item.contact_phone, "保障能力": item.capabilities.join(","), "能力值": item.capacity, "状态": item.status, "维保到期": item.maintenance_due_at || "" }))); }

  async function addWarehouse(form: FormData) {
    if (!requireWrite()) return;
    const record: Warehouse = { id: uid(), code: String(form.get("code")).trim().toUpperCase(), name: String(form.get("name")), area: String(form.get("area")), address: String(form.get("address") || ""), contact_name: String(form.get("contactName") || ""), contact_phone: String(form.get("contactPhone") || ""), active: true, created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, warehouses: [record, ...current.warehouses] }, "新增仓库", "warehouse"));
    else { const { error } = await createClient().from("warehouses").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增仓库", "warehouse"); await load(); }
  }
  async function addInventoryItem(form: FormData) {
    if (!requireWrite()) return;
    const record: InventoryItem = { id: uid(), sku: String(form.get("sku")).trim().toUpperCase(), name: String(form.get("name")), category: String(form.get("category")), unit: String(form.get("unit")), min_quantity: Number(form.get("minQuantity") || 0), max_quantity: Number(form.get("maxQuantity") || 0), maintenance_days: Number(form.get("maintenanceDays") || 365), created_at: now() };
    if (record.max_quantity < record.min_quantity) return setNotice("库存上限不能低于下限。");
    if (!user) setData((current) => withLocalLog({ ...current, inventoryItems: [record, ...current.inventoryItems] }, "新增物资目录", "inventory_item"));
    else { const { error } = await createClient().from("inventory_items").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增物资目录", "inventory_item"); await load(); }
  }
  async function createInventoryDocument(form: FormData) {
    if (!requireWrite()) return;
    const documentType = String(form.get("documentType")) as InventoryDocument["document_type"];
    const fromWarehouseId = String(form.get("fromWarehouseId") || "") || null; const toWarehouseId = String(form.get("toWarehouseId") || "") || null;
    if ((documentType === "inbound" && !toWarehouseId) || (documentType === "outbound" && !fromWarehouseId) || (documentType === "transfer" && (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId))) return setNotice("请按单据类型正确选择调出/调入仓库。");
    const document: InventoryDocument = { id: uid(), document_no: `XH-${documentType.toUpperCase()}-${Date.now()}`, document_type: documentType, from_warehouse_id: fromWarehouseId, to_warehouse_id: toWarehouseId, status: "draft", note: String(form.get("note") || ""), created_at: now() };
    const line: InventoryDocumentLine = { id: uid(), document_id: document.id, item_id: String(form.get("itemId")), quantity: Number(form.get("quantity")), created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, inventoryDocuments: [document, ...current.inventoryDocuments], inventoryDocumentLines: [line, ...current.inventoryDocumentLines] }, "创建库存单据", "inventory_document", { documentNo: document.document_no }));
    else { const supabase = createClient(); const created = await supabase.from("inventory_documents").insert({ ...forInsert(document), user_id: user.id }).select("id").single(); if (created.error) return setNotice(created.error.message); const lineResult = await supabase.from("inventory_document_lines").insert({ item_id: line.item_id, quantity: line.quantity, document_id: created.data.id }); if (lineResult.error) { await supabase.from("inventory_documents").delete().eq("id", created.data.id); return setNotice(lineResult.error.message); } await audit("创建库存单据", "inventory_document", created.data.id); await load(); }
    setNotice("库存单据草稿已创建。");
  }
  async function submitInventoryDocument(document: InventoryDocument) {
    if (!requireWrite()) return;
    if (!user) setData((current) => withLocalLog({ ...current, inventoryDocuments: current.inventoryDocuments.map((item) => item.id === document.id ? { ...item, status: "pending" } : item) }, "提交库存单据审核", "inventory_document"));
    else { const { error } = await createClient().from("inventory_documents").update({ status: "pending", updated_at: now() }).eq("id", document.id); if (error) return setNotice(error.message); await audit("提交库存单据审核", "inventory_document", document.id); await load(); }
  }
  async function postInventoryDocument(document: InventoryDocument, action: "approve" | "cancel") {
    if (role !== "admin" && user) return setNotice("只有管理员可以审核记账或撤销单据。");
    if (action === "approve" && !confirmAction(`确认审核单据 ${document.document_no} 并更新库存余额？`)) return;
    if (action === "cancel" && !confirmAction(`撤销 ${document.document_no} 将生成反向冲销流水。确认继续？`)) return;
    if (!user) {
      try {
        setData((current) => {
          const documentLines = current.inventoryDocumentLines.filter((line) => line.document_id === document.id);
          const baseMovements = action === "approve" ? documentLines.flatMap((line) => document.document_type === "inbound" ? [{ warehouse_id: document.to_warehouse_id!, item_id: line.item_id, quantity_delta: line.quantity }] : document.document_type === "outbound" ? [{ warehouse_id: document.from_warehouse_id!, item_id: line.item_id, quantity_delta: -line.quantity }] : [{ warehouse_id: document.from_warehouse_id!, item_id: line.item_id, quantity_delta: -line.quantity }, { warehouse_id: document.to_warehouse_id!, item_id: line.item_id, quantity_delta: line.quantity }]) : current.inventoryMovements.filter((movement) => movement.document_id === document.id && !movement.reversal_of).map((movement) => ({ warehouse_id: movement.warehouse_id, item_id: movement.item_id, quantity_delta: -movement.quantity_delta }));
          const balances = applyInventoryDeltas(current.inventoryBalances, baseMovements, now());
          const movements: InventoryMovement[] = baseMovements.map((movement) => ({ id: uid(), document_id: document.id, ...movement, reversal_of: action === "cancel" ? current.inventoryMovements.find((item) => item.document_id === document.id && item.warehouse_id === movement.warehouse_id && item.item_id === movement.item_id && !item.reversal_of)?.id || null : null, created_at: now() }));
          return withLocalLog({ ...current, inventoryBalances: balances, inventoryMovements: [...movements, ...current.inventoryMovements], inventoryDocuments: current.inventoryDocuments.map((item) => item.id === document.id ? { ...item, status: action === "approve" ? "approved" : "cancelled", approved_at: action === "approve" ? now() : item.approved_at, cancelled_at: action === "cancel" ? now() : item.cancelled_at } : item) }, action === "approve" ? "审核库存单据并记账" : "撤销库存单据并冲销", "inventory_document");
        });
      } catch (error) { return setNotice(error instanceof Error ? error.message : "库存记账失败。"); }
    } else { const { error } = await createClient().rpc("post_inventory_document", { p_document_id: document.id, p_action: action }); if (error) return setNotice(error.message); await audit(action === "approve" ? "审核库存单据并记账" : "撤销库存单据并冲销", "inventory_document", document.id); await load(); }
    setNotice(action === "approve" ? "单据已审核，库存余额已原子更新。" : "单据已撤销，库存已反向冲销。");
  }
  async function importInventory(file?: File) {
    if (!file || !requireWrite()) return;
    try {
      const rows = await readWorkbook(file); let warehouseCount = 0; let itemCount = 0;
      for (const row of rows) {
        const kind = sheetCell(row, "数据类型", "type");
        if (kind === "仓库" || kind === "warehouse") { const form = new FormData(); form.set("code", sheetCell(row, "编码", "code")); form.set("name", sheetCell(row, "名称", "name")); form.set("area", sheetCell(row, "区域", "area")); form.set("address", sheetCell(row, "地址", "address")); form.set("contactName", sheetCell(row, "联系人", "contact_name")); form.set("contactPhone", sheetCell(row, "电话", "contact_phone")); await addWarehouse(form); warehouseCount++; }
        if (kind === "物资" || kind === "item") { const form = new FormData(); form.set("sku", sheetCell(row, "编码", "sku")); form.set("name", sheetCell(row, "名称", "name")); form.set("category", sheetCell(row, "分类", "category")); form.set("unit", sheetCell(row, "单位", "unit")); form.set("minQuantity", sheetCell(row, "库存下限", "min_quantity")); form.set("maxQuantity", sheetCell(row, "库存上限", "max_quantity")); form.set("maintenanceDays", sheetCell(row, "维保周期天", "maintenance_days")); await addInventoryItem(form); itemCount++; }
      }
      if (!warehouseCount && !itemCount) throw new Error("请在“数据类型”列填写“仓库”或“物资”");
      setNotice(`导入完成：${warehouseCount} 个仓库，${itemCount} 种物资。`);
    } catch (error) { setNotice(`库存导入失败：${error instanceof Error ? error.message : "文件格式不正确"}`); }
  }
  async function exportInventory() { await downloadWorkbook("仓储物资台账.xlsx", "库存余额", data.inventoryBalances.map((balance) => { const warehouse = data.warehouses.find((item) => item.id === balance.warehouse_id); const item = data.inventoryItems.find((candidate) => candidate.id === balance.item_id); return { "仓库编码": warehouse?.code, "仓库": warehouse?.name, "物资编码": item?.sku, "物资": item?.name, "单位": item?.unit, "库存": balance.quantity, "预留": balance.reserved_quantity, "可用": balance.quantity - balance.reserved_quantity, "库存下限": item?.min_quantity }; })); }

  async function addRisk(form: FormData) {
    if (!requireWrite()) return;
    const record: RiskRecord = { id: uid(), name: String(form.get("name")), area: String(form.get("area")), record_type: String(form.get("recordType")), source: String(form.get("source")), change_type: String(form.get("changeType")) as RiskRecord["change_type"], old_value: String(form.get("oldValue") || ""), new_value: String(form.get("newValue")), assigned_org: "", assignee_user_id: null, assignee_organization_id: null, status: "待派单", source_record_id: `MANUAL-${Date.now()}`, created_at: now() };
    const change: RiskFieldChange = { id: uid(), risk_record_id: record.id, field_name: "主要内容", old_value: record.old_value, new_value: record.new_value, created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, risks: [record, ...current.risks], riskChanges: [change, ...current.riskChanges] }, "新增风险差异工单", "risk"));
    else { const created = await createClient().from("risk_records").insert({ ...forInsert(record), user_id: user.id }).select("id").single(); if (created.error) return setNotice(created.error.message); const { error } = await createClient().from("risk_field_changes").insert({ risk_record_id: created.data.id, field_name: change.field_name, old_value: change.old_value, new_value: change.new_value }); if (error) return setNotice(error.message); await audit("新增风险差异工单", "risk", created.data.id); await load(); }
  }
  async function bulkAssignRisks(ids: string[], organizationId: string, profileId: string) {
    if (!requireWrite() || !ids.length) return;
    if (user && role !== "admin") return setNotice("批量修改归属只允许管理员操作。");
    const org = organizations.find((item) => item.id === organizationId); const profile = profiles.find((item) => item.id === profileId);
    const assignedOrg = org?.name || profile?.display_name || profile?.email || "";
    if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.map((item) => ids.includes(item.id) ? { ...item, assigned_org: assignedOrg, assignee_organization_id: organizationId || null, assignee_user_id: profileId || null, status: "待确认" } : item) }, "批量派发风险工单", "risk", { count: ids.length }));
    else { const { error } = await createClient().from("risk_records").update({ assigned_org: assignedOrg, assignee_organization_id: organizationId || null, assignee_user_id: profileId || null, status: "待确认", updated_at: now() }).in("id", ids); if (error) return setNotice(error.message); await audit("批量派发风险工单", "risk", undefined, { count: ids.length }); await load(); }
    setNotice(`已批量派发 ${ids.length} 条风险工单。`);
  }
  async function transitionRisk(risk: RiskRecord, action: "dispatch" | "confirm" | "return", reason = "") {
    if (!requireWrite()) return;
    if (action === "dispatch") {
      if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, status: "待确认" } : item) }, "派发风险工单", "risk"));
      else { const { error } = await createClient().from("risk_records").update({ status: "待确认", updated_at: now() }).eq("id", risk.id); if (error) return setNotice(error.message); await audit("派发风险工单", "risk", risk.id); await load(); }
      return;
    }
    if (action === "return") {
      if (!reason.trim()) return setNotice("退回时必须填写理由。");
      if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, status: "退回核查", rejection_reason: reason } : item) }, "退回风险工单", "risk", { reason }));
      else { const { error } = await createClient().from("risk_records").update({ status: "退回核查", rejection_reason: reason, updated_at: now() }).eq("id", risk.id); if (error) return setNotice(error.message); await audit("退回风险工单", "risk", risk.id, { reason }); await load(); }
      return;
    }
    const adapterCode = risk.source.includes("数据仓") ? "WAREHOUSE_SIM" : "IRS_SIM";
    const success = !risk.name.includes("失败");
    if (!user) {
      const job: RiskWritebackJob = { id: uid(), risk_record_id: risk.id, adapter_code: adapterCode, idempotency_key: `${adapterCode}:${risk.id}`, status: success ? "succeeded" : "failed", attempt_count: 1, response_payload: success ? { simulated: true } : {}, error_message: success ? "" : "模拟网络超时", next_retry_at: success ? null : new Date(Date.now() + 300000).toISOString(), created_at: now() };
      setData((current) => withLocalLog({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, status: success ? "已回写" : "回写失败", confirmed_at: now(), writeback_message: success ? "模拟适配器已成功接收" : "模拟网络超时" } : item), riskWritebackJobs: [job, ...current.riskWritebackJobs.filter((item) => item.risk_record_id !== risk.id)] }, "确认并回写风险数据", "risk_writeback", { success }));
    } else {
      const supabase = createClient(); const queued = await supabase.rpc("queue_risk_writeback", { p_risk_id: risk.id, p_adapter_code: adapterCode }); if (queued.error) return setNotice(queued.error.message);
      const completed = await supabase.rpc("complete_simulated_risk_writeback", { p_job_id: queued.data, p_success: success, p_error: success ? "" : "模拟网络超时" }); if (completed.error) return setNotice(completed.error.message);
      await audit("确认并回写风险数据", "risk_writeback", risk.id, { adapterCode, success }); await load();
    }
    setNotice(success ? "已确认并通过模拟适配器完成回写。" : "模拟回写失败，已记录重试和对账状态。");
  }
  async function retryRiskWriteback(job: RiskWritebackJob) {
    if (!requireWrite()) return;
    if (!user) setData((current) => withLocalLog({ ...current, riskWritebackJobs: current.riskWritebackJobs.map((item) => item.id === job.id ? { ...item, status: "succeeded", attempt_count: item.attempt_count + 1, error_message: "", next_retry_at: null } : item), risks: current.risks.map((item) => item.id === job.risk_record_id ? { ...item, status: "已回写", writeback_message: "模拟适配器重试成功" } : item) }, "重试风险回写", "risk_writeback"));
    else { const { error } = await createClient().rpc("complete_simulated_risk_writeback", { p_job_id: job.id, p_success: true, p_error: "" }); if (error) return setNotice(error.message); await audit("重试风险回写", "risk_writeback", job.risk_record_id); await load(); }
    setNotice("回写重试成功，对账状态已更新。");
  }
  async function importRiskBatch(file: File | undefined, sourceCode: string) {
    if (!file || !requireWrite()) return;
    try {
      const rows = await readWorkbook(file); if (!rows.length) throw new Error("工作表为空");
      const batch: RiskImportBatch = { id: uid(), batch_no: `RISK-${Date.now()}`, source_code: sourceCode, file_name: file.name, status: "completed", total_count: rows.length, created_count: 0, changed_count: 0, deleted_count: 0, created_at: now() };
      const records = rows.map((row, index): RiskRecord => { const changeType = (sheetCell(row, "差异类型", "change_type") || "变更") as RiskRecord["change_type"]; if (changeType === "新增") batch.created_count++; else if (changeType === "删减") batch.deleted_count++; else batch.changed_count++; return { id: uid(), batch_id: batch.id, source_record_id: sheetCell(row, "源数据ID", "source_record_id") || `${sourceCode}-${index + 1}`, name: sheetCell(row, "对象名称", "name"), area: sheetCell(row, "区域", "area"), record_type: sheetCell(row, "对象类型", "record_type"), source: sheetCell(row, "数据来源", "source") || sourceCode, change_type: changeType, old_value: sheetCell(row, "原值", "old_value"), new_value: sheetCell(row, "新值", "new_value"), status: "待派单", assigned_org: "", created_at: now() }; }).filter((record) => record.name && record.area && record.record_type);
      if (!records.length) throw new Error("缺少对象名称、区域或对象类型"); batch.total_count = records.length;
      const changes: RiskFieldChange[] = records.map((record) => ({ id: uid(), risk_record_id: record.id, field_name: "主要内容", old_value: record.old_value, new_value: record.new_value, created_at: now() }));
      if (!user) setData((current) => withLocalLog({ ...current, riskBatches: [batch, ...current.riskBatches], risks: [...records, ...current.risks], riskChanges: [...changes, ...current.riskChanges] }, "导入风险普查批次", "risk_batch", { count: records.length }));
      else { const supabase = createClient(); const createdBatch = await supabase.from("risk_import_batches").insert({ ...forInsert(batch), user_id: user.id }).select("id").single(); if (createdBatch.error) throw createdBatch.error; for (const [index, record] of records.entries()) { const created = await supabase.from("risk_records").insert({ ...forInsert({ ...record, batch_id: createdBatch.data.id }), user_id: user.id }).select("id").single(); if (created.error) throw created.error; const change = changes[index]; const insertedChange = await supabase.from("risk_field_changes").insert({ risk_record_id: created.data.id, field_name: change.field_name, old_value: change.old_value, new_value: change.new_value }); if (insertedChange.error) throw insertedChange.error; } await audit("导入风险普查批次", "risk_batch", createdBatch.data.id, { count: records.length, sourceCode }); await load(); }
      setNotice(`风险批次导入成功，共 ${records.length} 条。`);
    } catch (error) { setNotice(`风险批次导入失败：${error instanceof Error ? error.message : "文件格式不正确"}`); }
  }
  async function exportRiskRows(format: "csv" | "xlsx", fields: string[], risks: RiskRecord[]) {
    const rows = risks.map((item) => ({ "对象名称": item.name, "区域": item.area, "对象类型": item.record_type, "数据来源": item.source, "差异类型": item.change_type, "原值": item.old_value, "新值": item.new_value, "状态": item.status, "承办机构": item.assigned_org || "" }));
    const selectedRows = rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field as keyof typeof row]])));
    if (format === "xlsx") await downloadWorkbook("风险普查筛选数据.xlsx", "风险普查", selectedRows); else downloadCsv("风险普查筛选数据.csv", fields, selectedRows);
  }
  async function removeRisk(riskId: string) {
    if (!requireWrite()) return;
    const risk = data.risks.find((item) => item.id === riskId);
    if (risk && risk.status !== "待派单") return setNotice("已进入确认或回写流程的工单不得直接删除，请退回或保留审计记录。");
    if (!confirmAction("确认删除这条尚未派发的风险工单？此操作无法恢复。")) return;
    if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.filter((item) => item.id !== riskId) }, "删除风险工单", "risk"));
    else { const { error } = await createClient().from("risk_records").delete().eq("id", riskId); if (error) return setNotice(error.message); await audit("删除风险工单", "risk", riskId); await load(); }
  }

  async function addMonitoringAsset(domain: MonitoringDomain, form: FormData) {
    if (!requireWrite()) return;
    const asset: MonitoringAsset = { id: uid(), code: String(form.get("code")).trim().toUpperCase(), name: String(form.get("name")), domain, asset_type: String(form.get("assetType")), area: String(form.get("area")), address: String(form.get("address") || ""), longitude: Number(form.get("longitude")), latitude: Number(form.get("latitude")), source_code: String(form.get("sourceCode") || "SIM_ADAPTER"), source_mode: "simulated", status: "online", last_seen_at: null, created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, monitoringAssets: [asset, ...current.monitoringAssets] }, "登记监测设备", "monitoring_asset", { code: asset.code }));
    else { const { error } = await createClient().from("monitoring_assets").insert({ ...forInsert(asset), user_id: user.id }); if (error) return setNotice(error.message); await audit("登记监测设备", "monitoring_asset", undefined, { code: asset.code }); await load(); }
    setNotice("设备或测站已登记。经纬度当前用于示意地图定位。");
  }

  async function addMonitoringRule(domain: MonitoringDomain, form: FormData) {
    if (!requireWrite()) return;
    const operator = String(form.get("operator")) as MonitoringRule["operator"]; const warning = Number(form.get("warning")); const critical = Number(form.get("critical"));
    if ((operator === "gte" && critical < warning) || (operator === "lte" && critical > warning)) return setNotice("严重阈值必须比预警阈值更严格。");
    const rule: MonitoringRule = { id: uid(), name: String(form.get("name")), domain, asset_type: String(form.get("assetType")), metric_code: String(form.get("metricCode")).trim(), operator, warning_threshold: warning, critical_threshold: critical, silence_minutes: Number(form.get("silence") || 30), enabled: true, created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, monitoringRules: [rule, ...current.monitoringRules] }, "新增监测阈值规则", "monitoring_rule", { name: rule.name }));
    else { const { error } = await createClient().from("monitoring_rules").insert({ ...forInsert(rule), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增监测阈值规则", "monitoring_rule", undefined, { name: rule.name }); await load(); }
    setNotice("阈值规则已保存，后续采集值将自动执行判断。");
  }

  async function ingestMonitoringReading(asset: MonitoringAsset, form: FormData) {
    if (!requireWrite()) return;
    const measuredAt = String(form.get("measuredAt") || "") ? new Date(String(form.get("measuredAt"))).toISOString() : now(); const metricCode = String(form.get("metricCode")).trim(); const value = Number(form.get("value")); const unit = String(form.get("unit"));
    if (!Number.isFinite(value)) return setNotice("监测值格式不正确。");
    if (!user) {
      const reading: MonitoringReading = { id: uid(), asset_id: asset.id, metric_code: metricCode, value, unit, measured_at: measuredAt, source_mode: "simulated", raw_payload: { adapter: "demo" }, created_at: now() };
      setData((current) => {
        let nextAlerts = [...current.monitoringAlerts]; let nextActions = [...current.monitoringActions]; let message = "监测值已写入，未触发阈值。";
        for (const rule of current.monitoringRules.filter((item) => item.enabled && item.domain === asset.domain && item.asset_type === asset.asset_type && item.metric_code === metricCode)) {
          const triggered = evaluateMonitoringRule(rule, value); if (!triggered) continue; const fingerprint = alertFingerprint(asset.id, metricCode, rule.id); const existing = nextAlerts.find((item) => item.fingerprint === fingerprint && item.status !== "closed");
          if (existing) { nextAlerts = nextAlerts.map((item) => item.id === existing.id ? { ...item, measured_value: value, threshold_value: triggered.threshold, level: triggered.level, occurrence_count: item.occurrence_count + 1, last_triggered_at: measuredAt, updated_at: now() } : item); nextActions = [{ id: uid(), alert_id: existing.id, action: "deduplicated", note: "重复告警已合并计数。", created_at: now() }, ...nextActions]; message = "阈值已触发，重复告警已合并。"; }
          else { const alertId = uid(); nextAlerts = [{ id: alertId, asset_id: asset.id, rule_id: rule.id, fingerprint, metric_code: metricCode, measured_value: value, threshold_value: triggered.threshold, level: triggered.level, status: "open", occurrence_count: 1, first_triggered_at: measuredAt, last_triggered_at: measuredAt, created_at: now() }, ...nextAlerts]; nextActions = [{ id: uid(), alert_id: alertId, action: "created", note: "阈值规则首次触发。", created_at: now() }, ...nextActions]; message = "阈值已触发，已生成新告警。"; }
        }
        queueMicrotask(() => setNotice(message));
        return withLocalLog({ ...current, monitoringReadings: [reading, ...current.monitoringReadings], monitoringAssets: current.monitoringAssets.map((item) => item.id === asset.id ? { ...item, status: "online", last_seen_at: measuredAt } : item), monitoringAlerts: nextAlerts, monitoringActions: nextActions }, "模拟适配器采集监测值", "monitoring_reading", { metricCode, value });
      });
    } else {
      const { data: result, error } = await createClient().rpc("ingest_monitoring_reading", { p_asset_id: asset.id, p_metric_code: metricCode, p_value: value, p_unit: unit, p_measured_at: measuredAt, p_raw_payload: { adapter: "demo" } }); if (error) return setNotice(error.message);
      await audit("模拟适配器采集监测值", "monitoring_reading", undefined, { assetId: asset.id, metricCode, value }); await load(); setNotice(result?.[0]?.alert_action === "created" ? "阈值已触发，已生成新告警。" : result?.[0]?.alert_action === "deduplicated" ? "阈值已触发，重复告警已合并。" : "监测值已写入，未触发阈值。");
    }
  }

  async function transitionMonitoringAlert(alert: MonitoringAlert, action: "claim" | "verify" | "convert" | "close") {
    if (!requireWrite()) return;
    if (action === "close" && !confirmAction("关闭告警前应确认它是误报、已解除或已有替代处置记录。确认关闭？")) return;
    const asset = data.monitoringAssets.find((item) => item.id === alert.asset_id); const actionName = action === "claim" ? "认领" : action === "verify" ? "复核" : action === "convert" ? "转事件" : "关闭"; let eventId: string | null = null;
    if (!user) {
      if (action === "convert") { eventId = uid(); const event: EventRecord = { id: eventId, event_type: asset?.domain === "city" ? "城市安全事件" : "暴雨内涝", response_level: alert.level === "critical" ? "II级" : "III级", area: asset?.area || "西湖区", happened_at: alert.last_triggered_at, description: `${asset?.name || "监测设备"}${alert.metric_code}触发阈值：${alert.measured_value}（模拟监测告警转入，需人工研判）`, status: "待研判", created_at: now() }; setData((current) => withLocalLog({ ...current, events: [event, ...current.events], monitoringAlerts: current.monitoringAlerts.map((item) => item.id === alert.id ? { ...item, status: "converted", event_id: eventId } : item), monitoringActions: [{ id: uid(), alert_id: alert.id, action: "converted", note: "告警已转入事件研判。", created_at: now() }, ...current.monitoringActions] }, "监测告警转事件", "monitoring_alert")); navigate("plans", eventId); setNotice("告警已转入事件研判并进入预案中心。"); return; }
      const nextStatus = action === "claim" ? "claimed" : action === "verify" ? "verified" : "closed"; setData((current) => withLocalLog({ ...current, monitoringAlerts: current.monitoringAlerts.map((item) => item.id === alert.id ? { ...item, status: nextStatus, claimed_at: action === "claim" ? now() : item.claimed_at, verified_at: action === "verify" ? now() : item.verified_at, closed_at: action === "close" ? now() : item.closed_at } : item), monitoringActions: [{ id: uid(), alert_id: alert.id, action: nextStatus, note: `告警已${actionName}。`, created_at: now() }, ...current.monitoringActions] }, `监测告警${actionName}`, "monitoring_alert")); setNotice(`告警已${actionName}。`); return;
    }
    const supabase = createClient();
    if (action === "convert") { const created = await supabase.from("events").insert({ user_id: user.id, event_type: asset?.domain === "city" ? "城市安全事件" : "暴雨内涝", response_level: alert.level === "critical" ? "II级" : "III级", area: asset?.area || "西湖区", happened_at: alert.last_triggered_at, description: `${asset?.name || "监测设备"}${alert.metric_code}触发阈值：${alert.measured_value}（模拟监测告警转入，需人工研判）`, status: "待研判" }).select("id").single(); if (created.error) return setNotice(created.error.message); eventId = created.data.id; }
    const { error } = await supabase.rpc("transition_monitoring_alert", { p_alert_id: alert.id, p_action: action, p_event_id: eventId }); if (error) return setNotice(error.message); await audit(`监测告警${actionName}`, "monitoring_alert", alert.id, { eventId }); await load();
    if (action === "convert") { navigate("plans", eventId || ""); setNotice("告警已转入事件研判并进入预案中心。"); } else setNotice(`告警已${actionName}。`);
  }

  async function addRecord(module: ProductModule, form: FormData) {
    if (!requireWrite()) return;
    const record: OperationalRecord = { id: uid(), module, record_type: String(form.get("recordType")), title: String(form.get("title")), status: String(form.get("status") || "正常"), area: String(form.get("area") || ""), owner_org: String(form.get("ownerOrg") || ""), summary: String(form.get("summary") || ""), source_mode: String(form.get("sourceMode") || "real") as OperationalRecord["source_mode"], details: { note: String(form.get("details") || "") }, created_at: now(), updated_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, records: [record, ...current.records] }, `新增${moduleMeta[module].title}记录`, module));
    else { const { error } = await createClient().from("operational_records").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit(`新增${moduleMeta[module].title}记录`, module); await load(); }
  }
  async function updateRecord(record: OperationalRecord, status: string) {
    if (!requireWrite()) return;
    if (!user) setData((current) => withLocalLog({ ...current, records: current.records.map((item) => item.id === record.id ? { ...item, status, updated_at: now() } : item) }, `更新${moduleMeta[record.module].title}记录`, record.module, { status }));
    else { const { error } = await createClient().from("operational_records").update({ status, updated_at: now() }).eq("id", record.id); if (error) return setNotice(error.message); await audit(`更新${moduleMeta[record.module].title}记录`, record.module, record.id, { status }); await load(); }
  }
  async function removeRecord(record: OperationalRecord) {
    if (!requireWrite()) return;
    if (!confirmAction(`确认删除“${record.title}”？正式业务建议通过归档保留历史记录。`)) return;
    if (!user) setData((current) => withLocalLog({ ...current, records: current.records.filter((item) => item.id !== record.id) }, `删除${moduleMeta[record.module].title}记录`, record.module));
    else { const { error } = await createClient().from("operational_records").delete().eq("id", record.id); if (error) return setNotice(error.message); await audit(`删除${moduleMeta[record.module].title}记录`, record.module, record.id); await load(); }
  }
  async function updateProfileRole(profileId: string, nextRole: Role) { if (!user || role !== "admin") return; const profile = profiles.find((item) => item.id === profileId); if (!confirmAction(`确认将 ${profile?.email || "该成员"} 的角色调整为 ${nextRole}？权限将立即变化。`)) return; const { error } = await createClient().from("profiles").update({ role: nextRole }).eq("id", profileId); if (error) return setNotice(error.message); await audit("调整成员角色", "profile", profileId, { role: nextRole }); await load(); }
  async function toggleProfile(profile: Profile) { if (!user || role !== "admin") return; if (profile.id === user.id && profile.active) return setNotice("不能停用当前登录的管理员账号。"); const active = !profile.active; if (!confirmAction(`${active ? "启用" : "停用"} ${profile.email || "该账号"}？${active ? "其业务访问将恢复。" : "其未完成任务会保留，但账号将无法访问业务数据。"}`)) return; const { error } = await createClient().from("profiles").update({ active }).eq("id", profile.id); if (error) return setNotice(error.message); await audit(active ? "启用账号" : "停用账号", "profile", profile.id); await load(); }
  async function addOrganization(form: FormData) {
    if (!user || role !== "admin") return;
    const { error } = await createClient().from("organizations").insert({ name: String(form.get("name")), code: String(form.get("code")).trim().toUpperCase(), org_type: String(form.get("orgType")), area: String(form.get("area") || ""), parent_id: String(form.get("parentId") || "") || null, created_by: user.id });
    if (error) return setNotice(error.message); await audit("新增组织机构", "organization", undefined, { name: String(form.get("name")) }); await load(); setNotice("组织机构已创建。");
  }
  async function addMembership(form: FormData) {
    if (!user || role !== "admin") return;
    const organizationId = String(form.get("organizationId")); const profileId = String(form.get("profileId"));
    const { error } = await createClient().from("organization_members").upsert({ organization_id: organizationId, user_id: profileId, position: String(form.get("position") || ""), membership_role: String(form.get("membershipRole") || "member"), is_primary: form.get("isPrimary") === "on", active: true, created_by: user.id }, { onConflict: "organization_id,user_id" });
    if (error) return setNotice(error.message); await audit("分配成员组织", "organization_member", undefined, { organizationId, profileId }); await load(); setNotice("成员组织归属已保存。");
  }
  async function createInvite(form: FormData) {
    if (!user || role !== "admin") return;
    const code = `XIHU-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    const { error } = await createClient().from("team_invites").insert({ label: String(form.get("label")), code_hash: await hashInviteCode(code), role: String(form.get("role")), organization_id: String(form.get("organizationId") || "") || null, max_uses: Number(form.get("maxUses") || 10), expires_at: String(form.get("expiresAt") || "") || null, created_by: user.id });
    if (error) return setNotice(error.message); setNewInviteCode(code); await audit("创建团队邀请码", "team_invite", undefined, { label: String(form.get("label")) }); await load();
  }
  async function disableInvite(invite: TeamInvite) { if (!user || role !== "admin") return; if (!confirmAction(`确认停用邀请码“${invite.label}”？尚未使用的成员将不能再凭此注册。`)) return; const { error } = await createClient().from("team_invites").update({ active: false }).eq("id", invite.id); if (error) return setNotice(error.message); await audit("停用团队邀请码", "team_invite", invite.id); await load(); }

  function exportData() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = `西湖应急产品数据-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  async function importData(file?: File) { if (!file || user) return setNotice("为避免覆盖团队数据，快照导入仅在访客模式开放。"); try { const parsed = JSON.parse(await file.text()) as unknown; if (!isSnapshot(parsed)) throw new Error(); setData({ ...empty, ...parsed, records: parsed.records || [], plans: parsed.plans || demoPlans, planVersions: parsed.planVersions || demoPlanVersions, planTemplates: parsed.planTemplates || demoPlanTaskTemplates, resources: parsed.resources || demoResources, warehouses: parsed.warehouses || demoWarehouses, inventoryItems: parsed.inventoryItems || demoInventoryItems, inventoryBalances: parsed.inventoryBalances || demoInventoryBalances, inventoryDocuments: parsed.inventoryDocuments || [], inventoryDocumentLines: parsed.inventoryDocumentLines || [], inventoryMovements: parsed.inventoryMovements || [], riskBatches: parsed.riskBatches || demoRiskBatches, riskChanges: parsed.riskChanges || demoRiskFieldChanges, riskWritebackJobs: parsed.riskWritebackJobs || [], monitoringAssets: parsed.monitoringAssets || demoMonitoringAssets, monitoringReadings: parsed.monitoringReadings || demoMonitoringReadings, monitoringRules: parsed.monitoringRules || demoMonitoringRules, monitoringAlerts: parsed.monitoringAlerts || demoMonitoringAlerts, monitoringActions: parsed.monitoringActions || demoMonitoringActions }); setNotice("快照已导入本机。"); } catch { setNotice("导入失败：文件格式不正确。"); } }
  async function signOut() { if (user) await createClient().auth.signOut(); window.location.assign(urlForPage("portal", window.location.hostname)); }

  const stats = useMemo(() => ({ events: data.events.length, executing: data.tasks.filter((item) => item.status !== "已完成").length, resources: data.resources.length, alerts: data.monitoringAlerts.filter((item) => item.status !== "closed").length }), [data]);
  if (loading) return <div className="loading">正在载入西湖应急综合平台…</div>;
  const writable = accountActive && canWrite(role);
  const common = { records: data.records, writable, onAdd: addRecord, onUpdate: updateRecord, onDelete: removeRecord };
  const isPortal = page === "portal";
  const pageLabel = productPages.find((item) => item.key === page)?.label;
  const activeEvent = data.events.find((item) => item.id === activeEventId);
  const roleLabel = role === "admin" ? "管理员" : role === "member" ? "业务成员" : "只读查看者";
  return <div className={`shell${isPortal ? " no-sidebar" : ""}${sidebarOpen ? " sidebar-open" : ""}`}><a className="skip-link" href="#main-content">跳到主要内容</a>{!isPortal && <aside aria-label="业务子产品导航"><div className="brand"><LogoMark size={40} outline="#6bc7c6" /><div><b>西湖应急</b><small>INTEGRATED OPERATIONS</small></div></div><nav>{productPages.filter((item) => item.key !== "admin" || role === "admin").map((item, index) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => navigate(item.key)} title={item.group}><i>{String(index + 1).padStart(2, "0")}</i>{item.label}</button>)}</nav><div className="aside-foot"><b>{user ? "SUPABASE 云端" : "本地演示"}</b><small>{user?.email || "仅限开发环境"}</small></div></aside>}{!isPortal && sidebarOpen && <button className="sidebar-backdrop" aria-label="关闭导航菜单" onClick={() => setSidebarOpen(false)} />}<main id="main-content"><header><div className="header-left">{!isPortal && <button className="menu-btn" aria-label="切换导航菜单" aria-expanded={sidebarOpen} title="切换导航菜单" onClick={() => setSidebarOpen((open) => !open)}><span /><span /><span /></button>}<span>西湖区应急管理综合平台 / {pageLabel}</span></div><div className="actions">{page !== "portal" && <button onClick={() => navigate("portal")}>返回综合门户</button>}<span className={user ? "badge" : "badge orange"}>{user ? `云端已连接 · ${roleLabel}` : "本地测试模式"}</span>{user && <button onClick={signOut}>安全退出</button>}</div></header><div className="workspace">{notice && <div className="notice" role="status" aria-live="polite"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")}>关闭</button></div>}
    {!isPortal && <EventContextBar event={activeEvent} tasks={data.tasks} plans={data.plans} onNavigate={navigate} onClear={() => navigate(page, "")} />}
    {page === "overview" && <OverviewPage stats={stats} data={data} role={accountActive ? role : "viewer"} onSeed={seed} onExport={exportData} onImport={() => importRef.current?.click()} importRef={importRef} importData={importData} />}
    {page === "portal" && <PortalPage data={data} role={role} currentUserId={user?.id} onOpen={navigate} />}{page === "typhoon" && <MonitoringCenterPage domain="typhoon" assets={data.monitoringAssets} readings={data.monitoringReadings} rules={data.monitoringRules} alerts={data.monitoringAlerts} actions={data.monitoringActions} writable={writable} onAddAsset={addMonitoringAsset} onAddRule={addMonitoringRule} onIngest={ingestMonitoringReading} onAlertAction={transitionMonitoringAlert} />}
    {page === "plans" && <PlanCenterPage plans={data.plans} versions={data.planVersions} templates={data.planTemplates} events={data.events} activeEventId={activeEventId} writable={writable} admin={role === "admin"} onAdd={addPlan} onLifecycle={transitionPlan} onDelete={removePlan} onStart={startPlan} />}
    {page === "command" && <CommandPage currentUserId={user?.id} activeEventId={activeEventId} events={data.events} tasks={data.tasks} profiles={profiles} organizations={organizations} writable={writable} onSelectEvent={setActiveEventId} onOpenRelated={navigate} onAddEvent={addEvent} onProgressEvent={progressEvent} onDeleteEvent={removeEvent} onAddTask={addTask} onProgressTask={progressTask} onDeleteTask={removeTask} />}
    {page === "resources" && <ResourceCenterPage resources={data.resources} events={data.events} activeEventId={activeEventId} writable={writable} onAdd={addResource} onStatus={updateResourceStatus} onImport={importResources} onExport={exportResources} />}
    {page === "inventory" && <InventoryCenterPage warehouses={data.warehouses} items={data.inventoryItems} balances={data.inventoryBalances} documents={data.inventoryDocuments} lines={data.inventoryDocumentLines} writable={writable} admin={!user || role === "admin"} onAddWarehouse={addWarehouse} onAddItem={addInventoryItem} onCreateDocument={createInventoryDocument} onSubmit={submitInventoryDocument} onPost={postInventoryDocument} onImport={importInventory} onExport={exportInventory} />}
    {page === "risks" && <RiskSurveyCenterPage risks={data.risks} batches={data.riskBatches} changes={data.riskChanges} jobs={data.riskWritebackJobs} profiles={profiles} organizations={organizations} writable={writable} admin={!user || role === "admin"} onAdd={addRisk} onBulkAssign={bulkAssignRisks} onTransition={transitionRisk} onDelete={removeRisk} onImport={importRiskBatch} onExport={exportRiskRows} onRetry={retryRiskWriteback} />}
    {page === "city" && <MonitoringCenterPage domain="city" assets={data.monitoringAssets} readings={data.monitoringReadings} rules={data.monitoringRules} alerts={data.monitoringAlerts} actions={data.monitoringActions} writable={writable} onAddAsset={addMonitoringAsset} onAddRule={addMonitoringRule} onIngest={ingestMonitoringReading} onAlertAction={transitionMonitoringAlert} />}{page === "duty" && <DutyCenterPage {...common} />}
    {page === "data" && <DataPage {...common} onExport={exportData} />}{page === "reviews" && <ReviewCenterPage {...common} events={data.events} tasks={data.tasks} activeEventId={activeEventId} onSelectEvent={setActiveEventId} />}
    {page === "logs" && <LogsPage logs={data.logs} />}{page === "admin" && role === "admin" && <AdminPage profiles={profiles} organizations={organizations} memberships={memberships} invites={invites} newInviteCode={newInviteCode} onRoleChange={updateProfileRole} onToggleProfile={toggleProfile} onAddOrganization={addOrganization} onAddMembership={addMembership} onCreateInvite={createInvite} onDisableInvite={disableInvite} />}
  </div></main></div>;
}
