"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthPanel } from "./auth-panel";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { demoEvent, demoRisks, demoTasks } from "@/lib/demo-data";
import type { ActivityLog, EventRecord, Profile, RiskRecord, Role, TaskRecord } from "@/lib/types";

type Page = "overview" | "sop" | "events" | "tasks" | "risks" | "logs" | "admin";
type Snapshot = { events: EventRecord[]; tasks: TaskRecord[]; risks: RiskRecord[]; logs: ActivityLog[] };
const STORAGE_KEY = "xihu-emergency-platform-v1";
const LEGACY_STORAGE_KEY = "xihu-emergency-stage-one-v1";
const empty: Snapshot = { events: [], tasks: [], risks: [], logs: [] };
const pages: Array<[Page, string]> = [["overview","项目介绍"],["sop","SOP 流程"],["events","事件管理"],["tasks","指令任务"],["risks","风险普查"],["logs","操作日志"],["admin","后台管理"]];

function id() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function canWrite(role: Role) { return role === "member" || role === "admin"; }
function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<Snapshot>;
  return [snapshot.events, snapshot.tasks, snapshot.risks, snapshot.logs].every(Array.isArray);
}
function readLocalSnapshot(): Snapshot {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return empty;
    const parsed: unknown = JSON.parse(stored);
    return isSnapshot(parsed) ? parsed : empty;
  } catch {
    return empty;
  }
}

export function EmergencyApp() {
  const [page, setPage] = useState<Page>("overview");
  const [data, setData] = useState<Snapshot>(empty);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("member");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const addLocalLog = useCallback((snapshot: Snapshot, action: string, entity: string, detail: Record<string, unknown>) => ({
    ...snapshot,
    logs: [{ id: id(), action, entity_type: entity, detail, created_at: now() }, ...snapshot.logs],
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    if (!hasSupabaseConfig()) {
      setData(readLocalSnapshot()); setLoading(false); return;
    }
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    setUser(authData.user);
    if (!authData.user) {
      setData(readLocalSnapshot()); setLoading(false); return;
    }
    const profileInsert = await supabase.from("profiles").insert({ id: authData.user.id, email: authData.user.email, role: "viewer" });
    if (profileInsert.error && profileInsert.error.code !== "23505") {
      setNotice("用户资料初始化失败：" + profileInsert.error.message);
    }
    const [events, tasks, risks, logs, profile] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("risk_records").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("role").eq("id", authData.user.id).single(),
    ]);
    const error = events.error || tasks.error || risks.error || logs.error;
    if (error) setNotice("云端读取失败：" + error.message);
    const currentRole = (profile.data?.role as Role) || "viewer";
    setRole(currentRole);
    if (currentRole === "admin") {
      const members = await supabase.from("profiles").select("id,email,display_name,role,created_at").order("created_at", { ascending: false });
      if (members.error) setNotice("成员列表读取失败：" + members.error.message);
      setProfiles((members.data as Profile[]) || []);
    } else setProfiles([]);
    setData({ events: events.data || [], tasks: tasks.data || [], risks: risks.data || [], logs: logs.data || [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!loading && !user) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, loading, user]);

  async function log(action: string, entityType: string, entityId: string, detail: Record<string, unknown>) {
    if (!user) return;
    await createClient().from("activity_logs").insert({ action, entity_type: entityType, entity_id: entityId, detail });
  }

  async function seed() {
    if (!canWrite(role)) return setNotice("当前角色为只读角色。");
    if (data.events.length || data.tasks.length || data.risks.length) return setNotice("当前已有数据，不再重复载入示例。");
    if (!user) {
      const next = addLocalLog({ events: [demoEvent], tasks: demoTasks, risks: demoRisks, logs: [] }, "载入示例数据", "workspace", { count: 7 });
      setData(next); setNotice("示例已保存到本机浏览器。"); return;
    }
    const supabase = createClient();
    const eventId = id();
    const { error: eventError } = await supabase.from("events").insert({ ...demoEvent, id: eventId, user_id: user.id });
    const { error: taskError } = await supabase.from("tasks").insert(demoTasks.map((t) => ({ ...t, id: id(), event_id: eventId, user_id: user.id })));
    const { error: riskError } = await supabase.from("risk_records").insert(demoRisks.map((r) => ({ ...r, id: id(), user_id: user.id })));
    const error = eventError || taskError || riskError;
    if (error) return setNotice("载入失败：" + error.message);
    await log("载入示例数据", "workspace", eventId, { count: 7 });
    await load(); setNotice("示例已保存到 Supabase。");
  }

  async function addEvent(form: FormData) {
    if (!canWrite(role)) return;
    const record: EventRecord = { id: id(), event_type: String(form.get("type")), response_level: String(form.get("level")), area: String(form.get("area")), happened_at: now(), description: String(form.get("description")), status: "待研判", created_at: now() };
    if (!user) setData((current) => addLocalLog({ ...current, events: [record, ...current.events] }, "新增事件", "event", { area: record.area }));
    else {
      const { error } = await createClient().from("events").insert({ ...record, user_id: user.id });
      if (error) return setNotice(error.message);
      await log("新增事件", "event", record.id, { area: record.area }); await load();
    }
    setNotice("事件已保存。");
  }

  async function removeEvent(eventId: string) {
    if (!canWrite(role)) return;
    if (!user) setData((current) => addLocalLog({ ...current, events: current.events.filter((e) => e.id !== eventId), tasks: current.tasks.filter((t) => t.event_id !== eventId) }, "删除事件", "event", { id: eventId }));
    else { const { error } = await createClient().from("events").delete().eq("id", eventId); if (error) return setNotice(error.message); await log("删除事件", "event", eventId, {}); await load(); }
  }

  async function progressEvent(event: EventRecord) {
    if (!canWrite(role)) return;
    const states = ["待研判", "处置中", "已结案"];
    const status = states[Math.min(Math.max(states.indexOf(event.status), 0) + 1, states.length - 1)];
    if (!user) setData((current) => addLocalLog({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, status } : item) }, "推进事件", "event", { status }));
    else { const { error } = await createClient().from("events").update({ status, updated_at: now() }).eq("id", event.id); if (error) return setNotice(error.message); await log("推进事件", "event", event.id, { status }); await load(); }
  }

  async function addTask(form: FormData) {
    if (!canWrite(role)) return;
    const record: TaskRecord = { id: id(), title: String(form.get("title")), assignee: String(form.get("assignee")), resource: String(form.get("resource")), due_minutes: Number(form.get("due")) || 30, status: "待查阅", created_at: now() };
    if (!user) setData((current) => addLocalLog({ ...current, tasks: [record, ...current.tasks] }, "新增任务", "task", { title: record.title }));
    else { const { error } = await createClient().from("tasks").insert({ ...record, user_id: user.id }); if (error) return setNotice(error.message); await log("新增任务", "task", record.id, { title: record.title }); await load(); }
    setNotice("任务已保存。");
  }

  async function removeTask(taskId: string) {
    if (!canWrite(role)) return;
    if (!user) setData((current) => addLocalLog({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }, "删除任务", "task", { id: taskId }));
    else { const { error } = await createClient().from("tasks").delete().eq("id", taskId); if (error) return setNotice(error.message); await log("删除任务", "task", taskId, {}); await load(); }
  }

  async function progressTask(task: TaskRecord) {
    if (!canWrite(role)) return;
    const states: TaskRecord["status"][] = ["待查阅", "已读", "已反馈", "已完成"];
    const status = states[Math.min(states.indexOf(task.status) + 1, 3)];
    if (!user) setData((current) => addLocalLog({ ...current, tasks: current.tasks.map((t) => t.id === task.id ? { ...t, status } : t) }, "推进任务", "task", { status }));
    else { const { error } = await createClient().from("tasks").update({ status, updated_at: now() }).eq("id", task.id); if (error) return setNotice(error.message); await log("推进任务", "task", task.id, { status }); await load(); }
  }

  async function progressRisk(risk: RiskRecord, status: RiskRecord["status"]) {
    if (!canWrite(role)) return;
    if (!user) setData((current) => addLocalLog({ ...current, risks: current.risks.map((r) => r.id === risk.id ? { ...r, status } : r) }, "更新风险工单", "risk", { status }));
    else { const { error } = await createClient().from("risk_records").update({ status, updated_at: now() }).eq("id", risk.id); if (error) return setNotice(error.message); await log("更新风险工单", "risk", risk.id, { status }); await load(); }
  }

  async function addRisk(form: FormData) {
    if (!canWrite(role)) return;
    const record: RiskRecord = { id: id(), name: String(form.get("name")), area: String(form.get("area")), record_type: String(form.get("recordType")), source: String(form.get("source")), change_type: String(form.get("changeType")) as RiskRecord["change_type"], old_value: String(form.get("oldValue")), new_value: String(form.get("newValue")), status: "待派单", created_at: now() };
    if (!user) setData((current) => addLocalLog({ ...current, risks: [record, ...current.risks] }, "新增风险工单", "risk", { name: record.name }));
    else { const { error } = await createClient().from("risk_records").insert({ ...record, user_id: user.id }); if (error) return setNotice(error.message); await log("新增风险工单", "risk", record.id, { name: record.name }); await load(); }
    setNotice("风险工单已保存。");
  }

  async function removeRisk(riskId: string) {
    if (!canWrite(role)) return;
    if (!user) setData((current) => addLocalLog({ ...current, risks: current.risks.filter((risk) => risk.id !== riskId) }, "删除风险工单", "risk", { id: riskId }));
    else { const { error } = await createClient().from("risk_records").delete().eq("id", riskId); if (error) return setNotice(error.message); await log("删除风险工单", "risk", riskId, {}); await load(); }
  }

  async function updateProfileRole(profileId: string, nextRole: Role) {
    if (!user || role !== "admin") return;
    const { error } = await createClient().from("profiles").update({ role: nextRole }).eq("id", profileId);
    if (error) return setNotice("权限更新失败：" + error.message);
    await log("调整成员权限", "profile", profileId, { role: nextRole });
    await load(); setNotice("成员权限已更新。");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "西湖应急工作台数据.json"; a.click(); URL.revokeObjectURL(a.href);
  }
  async function importData(file?: File) {
    if (!file || user) return setNotice(user ? "云端模式请使用业务表单录入，避免绕过审计。" : "请选择文件。");
    try { const parsed: unknown = JSON.parse(await file.text()); if (!isSnapshot(parsed)) throw new Error("invalid snapshot"); setData(addLocalLog(parsed, "导入工作台数据", "workspace", { file: file.name })); setNotice("数据已导入并保存到本机。"); }
    catch { setNotice("导入失败：文件格式不正确。"); }
  }
  async function signOut() { if (user) await createClient().auth.signOut(); setUser(null); setRole("member"); await load(); }

  const stats = useMemo(() => ({ events: data.events.length, tasks: data.tasks.length, done: data.tasks.filter((t) => t.status === "已完成").length, risks: data.risks.length }), [data]);
  if (loading) return <div className="loading">正在加载应急工作台…</div>;

  return <div className="shell">
    <aside><div className="brand"><span>湖</span><div><b>西湖应急</b><small>INTEGRATED OPERATIONS</small></div></div><nav>{pages.filter(([key])=>key!=="admin"||role==="admin").map(([key,label],i)=><button key={key} className={page===key?"active":""} onClick={()=>setPage(key)}><i>0{i+1}</i>{label}</button>)}</nav><div className="aside-foot"><b>{user ? "SUPABASE 云端" : "本机持久化"}</b><small>{user?.email || "访客模式"}</small></div></aside>
    <main><header><span>西湖区应急管理综合平台 / {pages.find(([key])=>key===page)?.[1]}</span><div className="actions"><span className={user?"badge":"badge orange"}>{user?"云端已连接":"本地演示"}</span>{user?<button onClick={signOut}>退出</button>:<button onClick={()=>setShowAuth(!showAuth)}>登录</button>}</div></header>
      <div className="workspace">{showAuth&&!user&&<AuthPanel onDone={()=>{setShowAuth(false);void load();}}/>}{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        {page==="overview"&&<OverviewPage stats={stats} role={role} onImportClick={()=>importRef.current?.click()} onExport={exportData} onSeed={seed} onImport={(file)=>void importData(file)} importRef={importRef}/>} {page==="sop"&&<SopPage/>}
        {page==="events"&&<EventsPage events={data.events} writable={canWrite(role)} onAdd={addEvent} onProgress={progressEvent} onDelete={removeEvent}/>} {page==="tasks"&&<TasksPage tasks={data.tasks} writable={canWrite(role)} onAdd={addTask} onProgress={progressTask} onDelete={removeTask}/>} {page==="risks"&&<RisksPage risks={data.risks} writable={canWrite(role)} onAdd={addRisk} onProgress={progressRisk} onDelete={removeRisk}/>} {page==="logs"&&<LogsPage logs={data.logs}/>} {page==="admin"&&role==="admin"&&<AdminPage profiles={profiles} currentUserId={user?.id} onRoleChange={updateProfileRole}/>} </div></main>
  </div>;
}

function Metric({title,value}:{title:string;value:number}) { return <div className="metric"><span>{title}</span><strong>{value}</strong><small>条云端或本地记录</small></div>; }
function OverviewPage({stats,role,onImportClick,onExport,onSeed,onImport,importRef}:{stats:{events:number;tasks:number;done:number;risks:number};role:Role;onImportClick:()=>void;onExport:()=>void;onSeed:()=>void;onImport:(file?:File)=>void;importRef:React.RefObject<HTMLInputElement|null>}) { return <><div className="pagehead"><div><span className="eyebrow">PROJECT INTRODUCTION</span><h1>西湖区应急管理综合平台</h1><p>一个入口贯通事件登记、任务调度、风险核查、结果回写和操作留痕。</p></div><div className="actions"><button onClick={onImportClick}>导入数据</button><button onClick={onExport}>导出数据</button><button className="primary" onClick={onSeed}>载入示例数据</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(event)=>onImport(event.target.files?.[0])}/></div></div><div className="metrics"><Metric title="事件" value={stats.events}/><Metric title="任务" value={stats.tasks}/><Metric title="已完成" value={stats.done}/><Metric title="风险工单" value={stats.risks}/></div><div className="intro-grid"><section className="panel"><span className="section-index">01</span><h2>项目总述</h2><p>平台面向应急事件、指令任务、风险普查工单和过程留痕，当前提供登录、数据库持久化、基础权限、增删改查、导入导出和操作日志。</p></section><section className="panel"><span className="section-index">02</span><h2>使用介绍</h2><p>访客数据保存在当前浏览器；登录成员的数据保存到 Supabase。viewer 只读，member 可维护本人数据，admin 可查看全局数据并管理成员角色。</p><p className="muted">当前角色：<b>{role}</b></p></section><section className="panel"><span className="section-index">03</span><h2>更新日志</h2><p><b>2026-09-18 · 第一阶段联网改造</b></p><p>完成 Next.js 重构、Supabase 数据库与认证、RLS、后台权限、Vercel 部署、GitHub 持续集成和自动化测试。</p><p className="muted">“第一阶段”仅作为历史更新记录，不作为项目名称。</p></section><section className="panel legal"><span className="section-index">04</span><h2>相关法律声明</h2><p>当前版本是教学、研究、投标演示和内部协作原型，不是政府机关正式生产系统，不构成行政决定或应急指令。</p><p>未经授权不得录入个人敏感信息、国家秘密、工作秘密、重要数据或其他受限制的政务数据；关键结论须由有权限人员核实、审批和复核。</p></section></div></>; }
function SopPage() { return <><div className="pagehead"><div><span className="eyebrow">STANDARD OPERATING PROCEDURE</span><h1>应急处置 SOP</h1><p>从线索登记到结案归档形成闭环；核查不通过时必须返回上一处置节点。</p></div></div><section className="panel sop-panel" aria-label="应急事件处置流程图"><div className="sop-flow"><SopNode step="01" title="线索登记" text="事件上报或风险预警"/><SopArrow/><SopNode step="02" title="核实研判" text="核实信息并确定响应等级"/><SopArrow/><SopNode step="03" title="建档调度" text="形成事件并下达任务资源"/><SopArrow/><SopNode step="04" title="现场处置" text="查阅接收、执行与反馈"/><SopArrow/><SopNode step="05" title="复核结案" text="复核结果并归档日志"/></div><div className="sop-return">未达到处置目标 → 退回核查、补充指令或重新调度</div></section><div className="grid sop-details"><section className="panel"><h2>事件处置闭环</h2><ol><li>登记事件时间、地点、类型、影响和证据。</li><li>信息不完整时退回补充核查。</li><li>完成响应研判后建立事件和任务。</li><li>责任人员接收、处置并反馈结果。</li><li>未达目标则重新调度；达标后复核结案。</li></ol></section><section className="panel"><h2>风险数据闭环</h2><ol><li>发现风险台账新增、变更或删减。</li><li>创建并派发核查工单。</li><li>责任人员确认；不通过则退回核查。</li><li>通过后回写风险台账并留存日志。</li></ol></section></div></>; }
function SopNode({step,title,text}:{step:string;title:string;text:string}) { return <div className="sop-node"><span>{step}</span><b>{title}</b><small>{text}</small></div>; }
function SopArrow() { return <span className="sop-arrow" aria-hidden="true">→</span>; }
function EventsPage({events,writable,onAdd,onProgress,onDelete}:{events:EventRecord[];writable:boolean;onAdd:(f:FormData)=>void;onProgress:(e:EventRecord)=>void;onDelete:(id:string)=>void}) { return <><div className="pagehead"><div><span className="eyebrow">EVENTS</span><h1>事件管理</h1><p>新增、查看、推进和删除事件；云端模式下刷新不会丢失。</p></div></div><div className="grid"><form className="panel form" action={onAdd}><h2>新增事件</h2><label>类型<select name="type"><option>暴雨内涝</option><option>台风</option><option>城市安全事件</option></select></label><label>响应等级<select name="level"><option>Ⅳ级</option><option>Ⅲ级</option><option>Ⅱ级</option><option>Ⅰ级</option></select></label><label>区域<input name="area" required defaultValue="转塘街道"/></label><label>现场描述<textarea name="description" required rows={4}/></label><button className="primary" disabled={!writable}>保存事件</button></form><section className="panel"><h2>事件列表</h2><div className="records">{events.length?events.map(e=><article key={e.id}><div><b>{e.event_type} · {e.response_level}</b><p>{e.area}｜{e.description}</p><span className="badge">{e.status}</span></div>{writable&&<div className="actions"><button disabled={e.status==="已结案"} onClick={()=>onProgress(e)}>推进</button><button onClick={()=>onDelete(e.id)}>删除</button></div>}</article>):<p className="empty">暂无事件</p>}</div></section></div></>; }
function TasksPage({tasks,writable,onAdd,onProgress,onDelete}:{tasks:TaskRecord[];writable:boolean;onAdd:(f:FormData)=>void;onProgress:(t:TaskRecord)=>void;onDelete:(id:string)=>void}) { return <><div className="pagehead"><div><span className="eyebrow">COMMAND</span><h1>指令任务</h1><p>新增任务，并按待查阅 → 已读 → 已反馈 → 已完成推进。</p></div></div><form className="panel form compact-form" action={onAdd}><h2>新增任务</h2><label>任务名称<input name="title" required/></label><label>接收对象<input name="assignee" required/></label><label>调配资源<input name="resource"/></label><label>时限（分钟）<input name="due" type="number" min="1" defaultValue="30" required/></label><button className="primary" disabled={!writable}>保存任务</button></form><section className="panel tablewrap"><table><thead><tr><th>任务</th><th>接收对象</th><th>资源</th><th>状态</th><th>操作</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.title}</td><td>{t.assignee}</td><td>{t.resource}</td><td><span className="badge">{t.status}</span></td><td><div className="actions"><button disabled={!writable||t.status==="已完成"} onClick={()=>onProgress(t)}>推进</button><button disabled={!writable} onClick={()=>onDelete(t.id)}>删除</button></div></td></tr>)}</tbody></table>{!tasks.length&&<p className="empty">暂无任务</p>}</section></>; }
function RisksPage({risks,writable,onAdd,onProgress,onDelete}:{risks:RiskRecord[];writable:boolean;onAdd:(f:FormData)=>void;onProgress:(r:RiskRecord,s:RiskRecord["status"])=>void;onDelete:(id:string)=>void}) { return <><div className="pagehead"><div><span className="eyebrow">RISK DATA</span><h1>风险普查工单</h1><p>新增、派单、确认、退回、回写和删除均会持久保存。</p></div></div><form className="panel form compact-form" action={onAdd}><h2>新增风险工单</h2><label>对象名称<input name="name" required/></label><label>区域<input name="area" required/></label><label>对象类型<input name="recordType" required/></label><label>数据来源<input name="source" required/></label><label>差异类型<select name="changeType"><option>新增</option><option>变更</option><option>删减</option></select></label><label>原值<input name="oldValue"/></label><label>新值<input name="newValue" required/></label><button className="primary" disabled={!writable}>保存工单</button></form><section className="panel tablewrap"><table><thead><tr><th>对象</th><th>差异</th><th>原值 → 新值</th><th>状态</th><th>操作</th></tr></thead><tbody>{risks.map(r=><tr key={r.id}><td><b>{r.name}</b><p>{r.area} · {r.record_type}</p></td><td>{r.change_type}</td><td><s>{r.old_value}</s><br/><b className="new">{r.new_value}</b></td><td>{r.status}</td><td><div className="actions">{r.status==="待派单"&&<button disabled={!writable} onClick={()=>onProgress(r,"待确认")}>派单</button>}{r.status==="待确认"&&<><button disabled={!writable} onClick={()=>onProgress(r,"已回写")}>确认</button><button disabled={!writable} onClick={()=>onProgress(r,"退回核查")}>退回</button></>}{r.status==="退回核查"&&<button disabled={!writable} onClick={()=>onProgress(r,"待确认")}>重派</button>}<button disabled={!writable} onClick={()=>onDelete(r.id)}>删除</button></div></td></tr>)}</tbody></table>{!risks.length&&<p className="empty">暂无风险工单</p>}</section></>; }
function LogsPage({logs}:{logs:ActivityLog[]}) { return <><div className="pagehead"><div><span className="eyebrow">AUDIT LOG</span><h1>操作日志</h1><p>记录关键业务动作，便于审计和问题追溯。</p></div></div><section className="panel records">{logs.length?logs.map(l=><article key={l.id}><div><b>{l.action}</b><p>{l.entity_type} · {new Date(l.created_at).toLocaleString("zh-CN")}</p></div></article>):<p className="empty">暂无操作日志</p>}</section></>; }
function AdminPage({profiles,currentUserId,onRoleChange}:{profiles:Profile[];currentUserId?:string;onRoleChange:(id:string,role:Role)=>void}) { return <><div className="pagehead"><div><span className="eyebrow">ADMINISTRATION</span><h1>后台管理</h1><p>查看成员并调整只读、成员和管理员权限。</p></div></div><section className="panel tablewrap"><table><thead><tr><th>账号</th><th>加入时间</th><th>角色</th><th>权限调整</th></tr></thead><tbody>{profiles.map(profile=><tr key={profile.id}><td><b>{profile.email||profile.display_name||"未填写"}</b>{profile.id===currentUserId&&<p>当前账号</p>}</td><td>{new Date(profile.created_at).toLocaleString("zh-CN")}</td><td><span className="badge">{profile.role}</span></td><td><select aria-label={`调整 ${profile.email||profile.id} 的角色`} value={profile.role} onChange={(event)=>onRoleChange(profile.id,event.target.value as Role)}><option value="viewer">viewer · 只读</option><option value="member">member · 可编辑</option><option value="admin">admin · 管理员</option></select></td></tr>)}</tbody></table>{!profiles.length&&<p className="empty">暂无成员</p>}</section></>; }
