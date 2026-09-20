"use client";

import { useMemo, useState, type ComponentProps } from "react";
import type { EventRecord, Organization, OrganizationMember, Profile, Role, TaskRecord, TeamInvite } from "@/lib/types";
import type { ProductPage } from "@/lib/product-catalog";
import { StatusBadge } from "./product-pages";
import { AdvancedCommandCenter } from "./command-experience";

const taskAction: Record<TaskRecord["status"], string> = { "待查阅": "标记已读", "已读": "填写现场反馈", "已反馈": "等待复核", "已完成": "已完成" };
const eventAction: Record<string, string> = { "待研判": "完成研判", "已研判": "启动处置", "处置中": "请在下方申请结案", "已终止": "已终止", "已结案": "已结案" };

function dueState(task: TaskRecord, referenceTime: number) {
  if (task.status === "已完成") return { text: "已完成", mode: "real" as const };
  const left = new Date(task.created_at).getTime() + task.due_minutes * 60_000 - referenceTime;
  if (left <= 0) return { text: `已超时 ${Math.max(1, Math.ceil(-left / 60_000))} 分钟`, mode: "external" as const };
  return { text: `剩余 ${Math.ceil(left / 60_000)} 分钟`, mode: left < 10 * 60_000 ? "simulated" as const : "real" as const };
}

function revealForm(id: "new-event" | "new-task") {
  const section = document.getElementById(id);
  if (section instanceof HTMLDetailsElement) section.open = true;
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CommandPage({ currentUserId, activeEventId, events, tasks, profiles, organizations, writable, onSelectEvent, onOpenRelated, onAddEvent, onProgressEvent, onDeleteEvent, onAddTask, onProgressTask, onDeleteTask, advanced }: {
  currentUserId?: string;
  activeEventId?: string;
  events: EventRecord[];
  tasks: TaskRecord[];
  profiles: Profile[];
  organizations: Organization[];
  writable: boolean;
  onSelectEvent: (eventId: string) => void;
  onOpenRelated: (page: ProductPage, eventId: string) => void;
  onAddEvent: (form: FormData) => void;
  onProgressEvent: (event: EventRecord) => void;
  onDeleteEvent: (id: string) => void;
  onAddTask: (form: FormData, eventId?: string) => void;
  onProgressTask: (task: TaskRecord) => void;
  onDeleteTask: (id: string) => void;
  advanced: Omit<ComponentProps<typeof AdvancedCommandCenter>, "selectedEvent" | "events" | "tasks" | "organizations" | "writable" | "onSelectEvent">;
}) {
  const [referenceTime] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const selectedEvent = events.find((item) => item.id === activeEventId) || events[0];
  const eventTasks = selectedEvent ? tasks.filter((item) => item.event_id === selectedEvent.id) : [];
  const filteredTasks = useMemo(() => tasks.filter((item) => {
    const matchesQuery = `${item.title}${item.assignee}${item.resource}${item.feedback || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = !status || item.status === status;
    const matchesMine = !mineOnly || item.assignee_user_id === currentUserId;
    return matchesQuery && matchesStatus && matchesMine;
  }), [tasks, query, status, mineOnly, currentUserId]);
  const completed = eventTasks.filter((item) => item.status === "已完成").length;
  const overdue = eventTasks.filter((item) => dueState(item, referenceTime).text.startsWith("已超时")).length;

  return <>
    <div className="pagehead"><div><span className="eyebrow">COMMAND & DISPATCH</span><h1>指挥调度</h1><p>围绕事件统一查看研判、预案、责任任务、处置时限和反馈证据。</p></div><div className="actions"><details className="action-menu"><summary>新建业务</summary><div><button onClick={() => revealForm("new-event")}>新建事件</button><button onClick={() => revealForm("new-task")}>下达指令</button></div></details></div></div>
    {selectedEvent ? <section className="incident-detail" aria-label="事件详情">
      <div className="incident-title"><div><span className="eyebrow">INCIDENT DETAIL</span><h2>{selectedEvent.event_type} · {selectedEvent.area}</h2><p>{selectedEvent.description}</p></div><StatusBadge>{selectedEvent.response_level} · {selectedEvent.status}</StatusBadge></div>
      <div className="incident-facts"><div><span>发生时间</span><b>{new Date(selectedEvent.happened_at).toLocaleString("zh-CN")}</b></div><div><span>任务完成</span><b>{completed}/{eventTasks.length}</b></div><div><span>超时未完</span><b>{overdue}</b></div><div><span>下一步</span><b>{eventAction[selectedEvent.status] || "人工复核"}</b></div></div>
      <div className="actions"><button onClick={() => onOpenRelated("plans", selectedEvent.id)}>匹配/查看预案</button><button onClick={() => onOpenRelated("resources", selectedEvent.id)}>调度资源</button><button onClick={() => onOpenRelated("inventory", selectedEvent.id)}>申请物资</button><button onClick={() => onOpenRelated("reviews", selectedEvent.id)}>进入复盘</button><button className="primary" disabled={!writable || ["处置中", "已终止", "已结案"].includes(selectedEvent.status)} onClick={() => onProgressEvent(selectedEvent)}>{eventAction[selectedEvent.status] || "更新状态"}</button>{eventTasks.length === 0 && selectedEvent.status === "待研判" && <button className="danger" disabled={!writable} onClick={() => onDeleteEvent(selectedEvent.id)}>删除空事件</button>}</div>
      {selectedEvent.status === "处置中" && eventTasks.some((item) => item.status !== "已完成") && <p className="inline-warning">仍有未完成任务，完成或说明异常后才能结案。</p>}
    </section> : <p className="empty">暂无事件，请先建立事件。</p>}

    <AdvancedCommandCenter {...advanced} selectedEvent={selectedEvent} events={events} tasks={tasks} organizations={organizations} writable={writable} onSelectEvent={onSelectEvent} />

    <section className="panel"><div className="table-toolbar"><div><h2>事件列表</h2><small>选择事件后在上方查看完整上下文</small></div><select aria-label="选择当前事件" value={selectedEvent?.id || ""} onChange={(event) => onSelectEvent(event.target.value)}>{events.map((item) => <option key={item.id} value={item.id}>{item.event_type} · {item.area} · {item.status}</option>)}</select></div><div className="event-card-grid">{events.map((event) => <button key={event.id} className={`event-choice ${event.id === selectedEvent?.id ? "active" : ""}`} onClick={() => onSelectEvent(event.id)}><span>{event.response_level}</span><b>{event.event_type}</b><small>{event.area} · {event.status}</small></button>)}</div></section>

    <section className="panel tablewrap"><div className="table-toolbar"><div><h2>指令跟踪</h2><small>状态、责任人、下一步和截止时间同时呈现</small></div><div className="filters-inline"><input aria-label="搜索指令" placeholder="搜索任务、人员或反馈" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="按指令状态筛选" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option>待查阅</option><option>已读</option><option>已反馈</option><option>已完成</option></select><label className="checkbox"><input type="checkbox" checked={mineOnly} onChange={(event) => setMineOnly(event.target.checked)} />只看我的待办</label></div></div><table><thead><tr><th>指令</th><th>事件/接收对象</th><th>状态与时限</th><th>明确动作</th></tr></thead><tbody>{filteredTasks.map((task) => { const due = dueState(task, referenceTime); const linkedEvent = events.find((item) => item.id === task.event_id); return <tr key={task.id} className={task.assignee_user_id === currentUserId ? "mine" : ""}><td><b>{task.title}</b><p>{task.resource || "未指定资源"} · {task.channel || "平台内"}</p>{task.feedback && <small>反馈：{task.feedback}</small>}{task.returned_reason && <p className="inline-warning">退回原因：{task.returned_reason}</p>}</td><td>{linkedEvent ? <button className="text-button" onClick={() => onSelectEvent(linkedEvent.id)}>{linkedEvent.event_type} · {linkedEvent.area}</button> : "独立任务"}<br /><small>{task.assignee}{task.assignee_user_id === currentUserId ? " · 我的待办" : ""}</small></td><td><StatusBadge>{task.status}</StatusBadge><br /><StatusBadge mode={due.mode}>{due.text}</StatusBadge></td><td><div className="actions vertical-actions"><button className={task.status === "已反馈" ? "primary" : ""} disabled={!writable || task.status === "已完成" || task.status === "已反馈"} onClick={() => onProgressTask(task)}>{taskAction[task.status]}</button><button className="danger" disabled={!writable} onClick={() => onDeleteTask(task.id)}>删除任务</button></div></td></tr>; })}</tbody></table>{!filteredTasks.length && <p className="empty">当前筛选条件下没有任务。可清除筛选或新建指令。</p>}</section>

    <div className="grid progressive-forms"><details className="panel" id="new-event"><summary><b>新建事件</b><small>登记时间、位置、区域、等级和现场描述</small></summary><form className="form" action={onAddEvent}><label>类型<select name="type"><option>暴雨内涝</option><option>台风</option><option>城市安全事件</option></select></label><label>响应等级<select name="level"><option>IV级</option><option>III级</option><option>II级</option><option>I级</option></select></label><label>发生时间<input name="happenedAt" type="datetime-local" /></label><label>区域<input name="area" required defaultValue="转塘街道" /></label><label>详细地址<input name="address" /></label><div className="weight-grid"><label>经度<input name="longitude" type="number" step="0.000001" defaultValue="120.078" /></label><label>纬度<input name="latitude" type="number" step="0.000001" defaultValue="30.159" /></label></div><label>现场描述<textarea name="description" required rows={4} /></label><button className="primary" disabled={!writable}>保存事件并进入研判</button></form></details>
      <details className="panel" id="new-task"><summary><b>手工下达指令</b><small>{selectedEvent ? `关联当前事件：${selectedEvent.event_type}` : "可创建独立任务"}</small></summary><form className="form" action={(form) => onAddTask(form, selectedEvent?.id)}><label>任务<input name="title" required /></label><label>接收人<select name="assigneeUserId"><option value="">不指定个人</option>{profiles.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.display_name || item.email}</option>)}</select></label><label>接收组织<select name="assigneeOrganizationId"><option value="">不指定组织</option>{organizations.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>调配资源<input name="resource" /></label><label>通知渠道<select name="channel"><option>平台内</option><option>短信（模拟）</option><option>移动端（模拟）</option></select></label><label>时限（分钟）<input name="due" type="number" min="1" defaultValue="30" /></label><button className="primary" disabled={!writable}>下达指令</button></form></details></div>
  </>;
}

export function AdminPage({ profiles, organizations, memberships, invites, newInviteCode, onRoleChange, onToggleProfile, onAddOrganization, onAddMembership, onCreateInvite, onDisableInvite }: { profiles: Profile[]; organizations: Organization[]; memberships: OrganizationMember[]; invites: TeamInvite[]; newInviteCode: string; onRoleChange: (id: string, role: Role) => void; onToggleProfile: (profile: Profile) => void; onAddOrganization: (form: FormData) => void; onAddMembership: (form: FormData) => void; onCreateInvite: (form: FormData) => void; onDisableInvite: (invite: TeamInvite) => void }) {
  const orgName = (id: string) => organizations.find((item) => item.id === id)?.name || "未知组织";
  return <><div className="pagehead"><div><span className="eyebrow">ADMINISTRATION</span><h1>后台管理</h1><p>账号、组织树、人员归属、邀请码和权限审计。</p></div><StatusBadge>高风险操作均需确认</StatusBadge></div><section className="panel tablewrap"><h2>成员与账号状态</h2><table><thead><tr><th>账号</th><th>组织/岗位</th><th>角色</th><th>账号操作</th></tr></thead><tbody>{profiles.map((profile) => { const links = memberships.filter((item) => item.user_id === profile.id && item.active); return <tr key={profile.id}><td>{profile.email || profile.display_name || "未填写"}<br /><StatusBadge mode={profile.active ? "real" : "external"}>{profile.active ? "已启用" : "已停用"}</StatusBadge></td><td>{links.map((item) => `${orgName(item.organization_id)}${item.position ? `·${item.position}` : ""}`).join("、") || "未分配"}</td><td><select aria-label={`调整${profile.email || profile.id}的角色`} value={profile.role} onChange={(event) => onRoleChange(profile.id, event.target.value as Role)}><option value="viewer">只读查看者</option><option value="member">业务成员</option><option value="admin">平台主管理员</option></select></td><td><button className={profile.active ? "danger" : ""} onClick={() => onToggleProfile(profile)}>{profile.active ? "停用账号" : "启用账号"}</button></td></tr>; })}</tbody></table></section><div className="grid"><form className="panel form" action={onAddOrganization}><h2>新增组织节点</h2><label>名称<input name="name" required /></label><label>编码<input name="code" required placeholder="XH-YJ-001" /></label><label>类型<select name="orgType"><option value="district">区级</option><option value="department">部门</option><option value="town">镇街</option><option value="community">村社</option><option value="workgroup">工作组</option></select></label><label>上级<select name="parentId"><option value="">无</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>区域<input name="area" /></label><button className="primary">创建组织</button></form><form className="panel form" action={onAddMembership}><h2>分配人员归属</h2><label>成员<select name="profileId" required>{profiles.map((item) => <option key={item.id} value={item.id}>{item.display_name || item.email}</option>)}</select></label><label>组织<select name="organizationId" required>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>岗位<input name="position" /></label><label>组织身份<select name="membershipRole"><option value="member">成员</option><option value="manager">负责人</option></select></label><label className="checkbox"><input type="checkbox" name="isPrimary" />设为主要组织</label><button className="primary" disabled={!profiles.length || !organizations.length}>保存归属</button></form></div><div className="grid"><form className="panel form" action={onCreateInvite}><h2>创建邀请码</h2><label>标签<input name="label" required placeholder="应急值守组成员" /></label><label>注册角色<select name="role"><option value="member">业务成员</option><option value="admin">平台主管理员</option></select></label><label>自动加入组织<select name="organizationId"><option value="">不自动分配</option>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>最大使用次数<input name="maxUses" type="number" min="1" defaultValue="10" /></label><label>到期时间<input name="expiresAt" type="datetime-local" /></label><button className="primary">生成邀请码</button>{newInviteCode && <div className="secret-once"><b>仅显示一次，请立即复制</b><code>{newInviteCode}</code></div>}</form><section className="panel tablewrap"><h2>邀请码管理</h2><table><thead><tr><th>标签</th><th>角色/组织</th><th>用量</th><th>状态</th></tr></thead><tbody>{invites.map((invite) => <tr key={invite.id}><td>{invite.label}</td><td>{invite.role === "admin" ? "管理员" : "成员"}<br /><small>{invite.organization_id ? orgName(invite.organization_id) : "未绑定"}</small></td><td>{invite.uses}/{invite.max_uses}</td><td><button className="danger" disabled={!invite.active} onClick={() => onDisableInvite(invite)}>{invite.active ? "停用邀请码" : "已停用"}</button></td></tr>)}</tbody></table></section></div></>;
}
