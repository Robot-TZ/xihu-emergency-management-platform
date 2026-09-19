"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { AuthPanel } from "./auth-panel";
import { demoEvent, demoRisks, demoTasks } from "@/lib/demo-data";
import { demoOperationalRecords, moduleMeta, productPages, type ProductPage } from "@/lib/product-catalog";
import type { ActivityLog, EventRecord, OperationalRecord, Organization, OrganizationMember, ProductModule, Profile, RiskRecord, Role, TaskRecord, TeamInvite } from "@/lib/types";
import { CityPage, DataPage, DutyPage, InventoryPage, LogsPage, OverviewPage, PlansPage, PortalPage, ResourcesPage, TyphoonPage } from "./product-pages";
import { AdminPage, CommandPage, RisksPage } from "./workflow-pages";

export type ProductSnapshot = { events: EventRecord[]; tasks: TaskRecord[]; risks: RiskRecord[]; logs: ActivityLog[]; records: OperationalRecord[] };
const empty: ProductSnapshot = { events: [], tasks: [], risks: [], logs: [], records: [] };
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

function isSnapshot(value: unknown): value is ProductSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<ProductSnapshot>;
  return Array.isArray(data.events) && Array.isArray(data.tasks) && Array.isArray(data.risks) && Array.isArray(data.logs);
}
function loadLocal(): ProductSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") as unknown;
    if (isSnapshot(parsed)) return { ...parsed, records: Array.isArray(parsed.records) ? parsed.records : demoOperationalRecords };
  } catch { /* corrupted visitor data falls back to safe defaults */ }
  return { ...empty, records: demoOperationalRecords };
}
function withLocalLog(data: ProductSnapshot, action: string, entity_type: string, detail: Record<string, unknown> = {}): ProductSnapshot {
  return { ...data, logs: [{ id: uid(), action, entity_type, detail, created_at: now() }, ...data.logs] };
}

export function EmergencyApp() {
  const [page, setPage] = useState<ProductPage>("overview");
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
  const [showAuth, setShowAuth] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig()) { setData(loadLocal()); setLoading(false); return; }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const current = auth.user;
    setUser(current);
    if (!current) { setData(loadLocal()); setRole("member"); setAccountActive(true); setProfiles([]); setOrganizations([]); setMemberships([]); setInvites([]); setLoading(false); return; }
    const profileResult = await supabase.from("profiles").select("id,email,display_name,role,organization,job_title,active,created_at").eq("id", current.id).maybeSingle();
    if (!profileResult.data) await supabase.from("profiles").insert({ id: current.id, email: current.email, role: "viewer" });
    const currentRole = (profileResult.data?.role || "viewer") as Role;
    const currentActive = profileResult.data?.active !== false;
    setRole(currentRole);
    setAccountActive(currentActive);
    const [events, tasks, risks, logs, records, orgs, orgMembers, visibleProfiles] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("risk_records").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("operational_records").select("*").order("created_at", { ascending: false }),
      supabase.from("organizations").select("*").order("name"),
      supabase.from("organization_members").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email,display_name,role,organization,job_title,active,created_at").order("created_at", { ascending: false }),
    ]);
    const failure = [events, tasks, risks, logs, records, orgs, orgMembers, visibleProfiles].find((result) => result.error)?.error;
    if (failure) setNotice("数据读取失败：" + failure.message);
    setData({ events: (events.data || []) as EventRecord[], tasks: (tasks.data || []) as TaskRecord[], risks: (risks.data || []) as RiskRecord[], logs: (logs.data || []) as ActivityLog[], records: (records.data || []) as OperationalRecord[] });
    setOrganizations((orgs.data || []) as Organization[]);
    setMemberships((orgMembers.data || []) as OrganizationMember[]);
    setProfiles((visibleProfiles.data || []) as Profile[]);
    if (currentRole === "admin") {
      const inviteRows = await supabase.from("team_invites").select("id,label,role,active,max_uses,uses,expires_at,organization_id,created_at").order("created_at", { ascending: false });
      setInvites((inviteRows.data || []) as TeamInvite[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    if (!hasSupabaseConfig()) return;
    const { data: listener } = createClient().auth.onAuthStateChange(() => void load());
    return () => listener.subscription.unsubscribe();
  }, [load]);
  useEffect(() => { if (!user && !loading) localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }, [data, user, loading]);

  function requireWrite() { if (!accountActive) { setNotice("账号已停用，请联系管理员。"); return false; } if (!canWrite(role)) { setNotice("当前角色为只读角色。"); return false; } return true; }
  async function audit(action: string, entity_type: string, entity_id?: string, detail: Record<string, unknown> = {}) {
    if (user) await createClient().from("activity_logs").insert({ user_id: user.id, action, entity_type, entity_id: entity_id && /^[0-9a-f-]{36}$/.test(entity_id) ? entity_id : null, detail });
  }

  async function seed() {
    if (!requireWrite()) return;
    if (!user) { setData(withLocalLog({ events: [demoEvent], tasks: demoTasks, risks: demoRisks, logs: [], records: demoOperationalRecords }, "初始化产品数据", "workspace")); setNotice("示例数据已保存到本机。"); return; }
    const supabase = createClient();
    if (!data.events.length) await supabase.from("events").insert({ ...forInsert(demoEvent), user_id: user.id });
    if (!data.records.length) await supabase.from("operational_records").insert(demoOperationalRecords.map((record) => ({ ...forInsert(record), user_id: user.id })));
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
    if (!user) setData((current) => withLocalLog({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, status } : item) }, "推进事件", "event", { status }));
    else { const { error } = await createClient().from("events").update({ status, updated_at: now() }).eq("id", event.id); if (error) return setNotice(error.message); await audit("推进事件", "event", event.id, { status }); await load(); }
  }
  async function removeEvent(eventId: string) {
    if (!requireWrite()) return;
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
    if (!user) setData((current) => withLocalLog({ ...current, tasks: current.tasks.filter((item) => item.id !== taskId) }, "删除指令任务", "task"));
    else { const { error } = await createClient().from("tasks").delete().eq("id", taskId); if (error) return setNotice(error.message); await audit("删除指令任务", "task", taskId); await load(); }
  }
  async function startPlan(event: EventRecord, plan: OperationalRecord) {
    if (!requireWrite()) return;
    const titles = Array.isArray(plan.details.tasks) ? plan.details.tasks : ["事件核查", "资源调度", "现场处置"];
    const tasks = titles.map((title, index): TaskRecord => ({ id: uid(), event_id: event.id, plan_id: plan.id, title, assignee: ["属地应急队", "物资保障组", "现场处置组"][index] || "应急处置组", resource: index === 1 ? "按预案调配" : "", channel: user ? "平台内" : "平台内（模拟发送）", status: "待查阅", due_minutes: 30, created_at: now() }));
    if (!user) setData((current) => withLocalLog({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, plan_id: plan.id, status: "处置中" } : item), tasks: [...tasks, ...current.tasks] }, "启动预案并生成指令", "plan", { plan: plan.title }));
    else {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").insert(tasks.map((task) => ({ ...forInsert(task), user_id: user.id })));
      if (error) return setNotice(error.message);
      await supabase.from("events").update({ plan_id: plan.id, status: "处置中", updated_at: now() }).eq("id", event.id);
      await audit("启动预案并生成指令", "plan", plan.id, { event: event.id }); await load();
    }
    setPage("command"); setNotice(`已启动《${plan.title}》并生成 ${tasks.length} 条指令。`);
  }

  async function addRisk(form: FormData) {
    if (!requireWrite()) return;
    const assigneeUserId = String(form.get("assigneeUserId") || "") || null;
    const assigneeOrganizationId = String(form.get("assigneeOrganizationId") || "") || null;
    if (assigneeUserId && assigneeOrganizationId) return setNotice("承办人与承办组织只能选择一项。");
    const targetUser = profiles.find((item) => item.id === assigneeUserId);
    const targetOrg = organizations.find((item) => item.id === assigneeOrganizationId);
    const assignedOrg = targetOrg?.name || targetUser?.display_name || targetUser?.email || "";
    const record: RiskRecord = { id: uid(), name: String(form.get("name")), area: String(form.get("area")), record_type: String(form.get("recordType")), source: String(form.get("source")), change_type: String(form.get("changeType")) as RiskRecord["change_type"], old_value: String(form.get("oldValue") || ""), new_value: String(form.get("newValue")), assigned_org: assignedOrg, assignee_user_id: assigneeUserId, assignee_organization_id: assigneeOrganizationId, status: "待派单", created_at: now() };
    if (!user) setData((current) => withLocalLog({ ...current, risks: [record, ...current.risks] }, "新增风险差异工单", "risk"));
    else { const { error } = await createClient().from("risk_records").insert({ ...forInsert(record), user_id: user.id }); if (error) return setNotice(error.message); await audit("新增风险差异工单", "risk"); await load(); }
  }
  async function progressRisk(risk: RiskRecord, status: RiskRecord["status"]) {
    if (!requireWrite()) return;
    const extra = status === "已回写" ? { writeback_message: "模拟适配器回写成功；真实数据仓待联调" } : {};
    if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, status, ...extra } : item) }, "更新风险工单", "risk", { status }));
    else { const { error } = await createClient().from("risk_records").update({ status, ...extra, updated_at: now() }).eq("id", risk.id); if (error) return setNotice(error.message); await audit("更新风险工单", "risk", risk.id, { status }); await load(); }
  }
  async function removeRisk(riskId: string) {
    if (!requireWrite()) return;
    if (!user) setData((current) => withLocalLog({ ...current, risks: current.risks.filter((item) => item.id !== riskId) }, "删除风险工单", "risk"));
    else { const { error } = await createClient().from("risk_records").delete().eq("id", riskId); if (error) return setNotice(error.message); await audit("删除风险工单", "risk", riskId); await load(); }
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
    if (!user) setData((current) => withLocalLog({ ...current, records: current.records.filter((item) => item.id !== record.id) }, `删除${moduleMeta[record.module].title}记录`, record.module));
    else { const { error } = await createClient().from("operational_records").delete().eq("id", record.id); if (error) return setNotice(error.message); await audit(`删除${moduleMeta[record.module].title}记录`, record.module, record.id); await load(); }
  }
  async function createEventFromAlert(record: OperationalRecord) {
    const form = new FormData(); form.set("type", record.module === "city_safety" ? "城市安全事件" : "暴雨内涝"); form.set("level", "III级"); form.set("area", record.area || "西湖区"); form.set("description", `${record.title}：${record.summary}（由模拟监测记录转入，需人工复核）`); await addEvent(form); setPage("plans");
  }
  async function updateProfileRole(profileId: string, nextRole: Role) { if (!user || role !== "admin") return; const { error } = await createClient().from("profiles").update({ role: nextRole }).eq("id", profileId); if (error) return setNotice(error.message); await audit("调整成员角色", "profile", profileId, { role: nextRole }); await load(); }
  async function toggleProfile(profile: Profile) { if (!user || role !== "admin") return; if (profile.id === user.id && profile.active) return setNotice("不能停用当前登录的管理员账号。"); const active = !profile.active; const { error } = await createClient().from("profiles").update({ active }).eq("id", profile.id); if (error) return setNotice(error.message); await audit(active ? "启用账号" : "停用账号", "profile", profile.id); await load(); }
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
  async function disableInvite(invite: TeamInvite) { if (!user || role !== "admin") return; const { error } = await createClient().from("team_invites").update({ active: false }).eq("id", invite.id); if (error) return setNotice(error.message); await audit("停用团队邀请码", "team_invite", invite.id); await load(); }

  function exportData() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = `西湖应急产品数据-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
  function exportRisks() { const rows = data.risks.map((item) => [item.name, item.area, item.record_type, item.source, item.change_type, item.old_value, item.new_value, item.status, item.assigned_org || ""]); const csv = "\uFEFF" + [["对象", "区域", "类型", "来源", "差异", "原值", "新值", "状态", "承办机构"], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "风险普查数据.csv"; a.click(); URL.revokeObjectURL(a.href); }
  async function importData(file?: File) { if (!file || user) return setNotice("为避免覆盖团队数据，快照导入仅在访客模式开放。"); try { const parsed = JSON.parse(await file.text()) as unknown; if (!isSnapshot(parsed)) throw new Error(); setData({ ...parsed, records: parsed.records || [] }); setNotice("快照已导入本机。"); } catch { setNotice("导入失败：文件格式不正确。"); } }
  async function signOut() { if (user) await createClient().auth.signOut(); setUser(null); setRole("member"); await load(); }

  const stats = useMemo(() => ({ events: data.events.length, executing: data.tasks.filter((item) => item.status !== "已完成").length, resources: data.records.filter((item) => item.module === "resources").length, alerts: data.records.filter((item) => ["monitoring", "city_safety"].includes(item.module) && ["超警", "待处置", "预警"].includes(item.status)).length }), [data]);
  if (loading) return <div className="loading">正在载入西湖应急综合平台…</div>;
  const writable = accountActive && canWrite(role);
  const common = { records: data.records, writable, onAdd: addRecord, onUpdate: updateRecord, onDelete: removeRecord };
  return <div className="shell"><aside><div className="brand"><span>湖</span><div><b>西湖应急</b><small>INTEGRATED OPERATIONS</small></div></div><nav>{productPages.filter((item) => item.key !== "admin" || role === "admin").map((item, index) => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)} title={item.group}><i>{String(index + 1).padStart(2, "0")}</i>{item.label}</button>)}</nav><div className="aside-foot"><b>{user ? "SUPABASE 云端" : "本机持久化"}</b><small>{user?.email || "访客模式"}</small></div></aside><main><header><span>西湖区应急管理综合平台 / {productPages.find((item) => item.key === page)?.label}</span><div className="actions"><span className={user ? "badge" : "badge orange"}>{user ? `云端已连接 · ${role}` : "本地产品体验"}</span>{user ? <button onClick={signOut}>退出</button> : <button onClick={() => setShowAuth(!showAuth)}>登录</button>}</div></header><div className="workspace">{showAuth && !user && <AuthPanel onDone={() => { setShowAuth(false); void load(); }} />}{notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}>关闭</button></div>}
    {page === "overview" && <OverviewPage stats={stats} data={data} role={accountActive ? role : "viewer"} onSeed={seed} onExport={exportData} onImport={() => importRef.current?.click()} importRef={importRef} importData={importData} />}
    {page === "portal" && <PortalPage data={data} role={role} />}{page === "typhoon" && <TyphoonPage {...common} onCreateEvent={createEventFromAlert} />}
    {page === "plans" && <PlansPage records={data.records} events={data.events} writable={writable} onAdd={addRecord} onDelete={removeRecord} onStart={startPlan} />}
    {page === "command" && <CommandPage currentUserId={user?.id} events={data.events} tasks={data.tasks} profiles={profiles} organizations={organizations} writable={writable} onAddEvent={addEvent} onProgressEvent={progressEvent} onDeleteEvent={removeEvent} onAddTask={addTask} onProgressTask={progressTask} onDeleteTask={removeTask} />}
    {page === "resources" && <ResourcesPage {...common} />}{page === "inventory" && <InventoryPage {...common} />}
    {page === "risks" && <RisksPage risks={data.risks} profiles={profiles} organizations={organizations} writable={writable} onAdd={addRisk} onProgress={progressRisk} onDelete={removeRisk} onExport={exportRisks} />}
    {page === "city" && <CityPage {...common} onCreateEvent={createEventFromAlert} />}{page === "duty" && <DutyPage {...common} />}
    {page === "data" && <DataPage {...common} onExport={exportData} />}{page === "reviews" && <ResourcesPage {...common} module="reviews" />}
    {page === "logs" && <LogsPage logs={data.logs} />}{page === "admin" && role === "admin" && <AdminPage profiles={profiles} organizations={organizations} memberships={memberships} invites={invites} newInviteCode={newInviteCode} onRoleChange={updateProfileRole} onToggleProfile={toggleProfile} onAddOrganization={addOrganization} onAddMembership={addMembership} onCreateInvite={createInvite} onDisableInvite={disableInvite} />}
  </div></main></div>;
}
