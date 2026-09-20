"use client";

import { useMemo, useState } from "react";
import type { EmergencyPlan, EventRecord, OperationalRecord, ProductModule, Profile, ReviewIssue, TaskRecord } from "@/lib/types";
import type { ProductPage } from "@/lib/product-catalog";
import { StatusBadge } from "./product-pages";

type RecordActions = {
  records: OperationalRecord[];
  writable: boolean;
  onAdd: (module: ProductModule, form: FormData) => void;
  onUpdate: (record: OperationalRecord, status: string) => void;
  onDelete: (record: OperationalRecord) => void;
};

export function EventContextBar({ event, tasks, plans, onNavigate, onClear }: {
  event?: EventRecord;
  tasks: TaskRecord[];
  plans: EmergencyPlan[];
  onNavigate: (page: ProductPage, eventId?: string) => void;
  onClear: () => void;
}) {
  if (!event) return null;
  const linkedTasks = tasks.filter((item) => item.event_id === event.id);
  const completed = linkedTasks.filter((item) => item.status === "已完成").length;
  const plan = plans.find((item) => item.id === event.emergency_plan_id || item.id === event.plan_id);
  return <section className="event-context" aria-label="当前事件上下文">
    <div><span className="eyebrow">CURRENT INCIDENT</span><b>{event.event_type} · {event.area}</b><small>{event.response_level}｜{event.status}｜任务 {completed}/{linkedTasks.length} 完成{plan ? `｜${plan.title}` : "｜尚未启动预案"}</small></div>
    <div className="actions"><button onClick={() => onNavigate("command", event.id)}>事件详情</button><button onClick={() => onNavigate("plans", event.id)}>预案</button><button onClick={() => onNavigate("resources", event.id)}>资源</button><button onClick={() => onNavigate("inventory", event.id)}>物资</button><button aria-label="清除当前事件上下文" onClick={onClear}>退出事件</button></div>
  </section>;
}

export function DutyCenterPage({ records, writable, onAdd, onUpdate, onDelete }: RecordActions) {
  const dutyRecords = records.filter((item) => item.module === "duty");
  const [query, setQuery] = useState("");
  const filtered = dutyRecords.filter((item) => `${item.title}${item.record_type}${item.owner_org}${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  const shifts = dutyRecords.filter((item) => item.record_type === "排班记录" && item.status !== "已结束");
  const handovers = dutyRecords.filter((item) => item.record_type === "交接班" && item.status !== "已完成");
  const pending = dutyRecords.filter((item) => !["已完成", "已结束", "已归档"].includes(item.status));
  return <>
    <div className="pagehead"><div><span className="eyebrow">DUTY OPERATIONS</span><h1>应急值班工作台</h1><p>把排班、值班日志、交接事项和通讯录放在同一条连续工作链中。</p></div><StatusBadge>{pending.length} 项待处理</StatusBadge></div>
    <div className="metrics"><div className="metric"><span>当前班次</span><strong>{shifts.length}</strong><small>进行中的排班</small></div><div className="metric"><span>待交接</span><strong>{handovers.length}</strong><small>不得直接遗漏结转</small></div><div className="metric"><span>值班记录</span><strong>{dutyRecords.filter((item) => item.record_type === "值班日志").length}</strong><small>过程留痕</small></div><div className="metric"><span>通讯对象</span><strong>{dutyRecords.filter((item) => item.record_type === "通讯录").length}</strong><small>岗位联络体系</small></div></div>
    <div className="grid"><form className="panel form" action={(form) => onAdd("duty", form)}><h2>登记值班事项</h2><label>事项类型<select name="recordType"><option>值班日志</option><option>交接班</option><option>排班记录</option><option>值班岗位</option><option>通讯录</option></select></label><label>标题<input name="title" required /></label><label>责任机构<input name="ownerOrg" required /></label><label>区域<input name="area" defaultValue="西湖区" /></label><label>事项摘要<textarea name="summary" rows={3} required /></label><input type="hidden" name="status" value="待处理" /><input type="hidden" name="sourceMode" value="real" /><button className="primary" disabled={!writable}>保存并纳入交接</button></form>
      <section className="panel"><h2>交接控制</h2><p className="muted">交班前逐项核对未结事项；接班人确认后才能标记完成。</p>{handovers.slice(0, 6).map((item) => <article className="recommend" key={item.id}><div><b>{item.title}</b><p>{item.summary}</p><small>{item.owner_org} · {item.status}</small></div><button disabled={!writable} onClick={() => onUpdate(item, item.status === "待处理" ? "待接班确认" : "已完成")}>{item.status === "待处理" ? "提交交班" : "接班确认"}</button></article>)}{!handovers.length && <p className="empty">当前无待交接事项。</p>}</section></div>
    <section className="panel tablewrap"><div className="table-toolbar"><div><h2>值班台账</h2><small>按事项、机构或摘要搜索</small></div><input aria-label="搜索值班台账" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索值班事项" /></div><table><thead><tr><th>事项</th><th>类型/机构</th><th>状态</th><th>下一步</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><b>{item.title}</b><p>{item.summary}</p></td><td>{item.record_type}<br /><small>{item.owner_org} · {item.area}</small></td><td><StatusBadge>{item.status}</StatusBadge></td><td><div className="actions"><button disabled={!writable || item.status === "已完成"} onClick={() => onUpdate(item, item.status === "待处理" ? "处理中" : "已完成")}>{item.status === "待处理" ? "开始处理" : "确认完成"}</button><button className="danger" disabled={!writable} onClick={() => onDelete(item)}>删除</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="empty">没有符合条件的值班事项。</p>}</section>
  </>;
}

export function ReviewCenterPage({ events, tasks, records, issues, profiles, activeEventId, writable, onSelectEvent, onAdd, onUpdate, onDelete, onAddIssue, onProgressIssue }: RecordActions & {
  events: EventRecord[];
  tasks: TaskRecord[];
  activeEventId?: string;
  issues: ReviewIssue[];
  profiles: Profile[];
  onSelectEvent: (eventId: string) => void;
  onAddIssue: (eventId: string, form: FormData) => void;
  onProgressIssue: (issue: ReviewIssue, verificationNote?: string) => void;
}) {
  const [referenceTime] = useState(() => Date.now());
  const reviews = records.filter((item) => item.module === "reviews");
  const selected = events.find((item) => item.id === activeEventId) || events[0];
  const linked = useMemo(() => selected ? tasks.filter((item) => item.event_id === selected.id) : [], [selected, tasks]);
  const completed = linked.filter((item) => item.status === "已完成");
  const late = linked.filter((item) => item.status !== "已完成" && referenceTime > new Date(item.created_at).getTime() + item.due_minutes * 60_000);
  const timeline = useMemo(() => [...linked].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)), [linked]);
  return <>
    <div className="pagehead"><div><span className="eyebrow">AFTER ACTION REVIEW</span><h1>灾后复盘</h1><p>自动汇集事件、任务、时限和反馈，形成可审核的复盘初稿。</p></div>{selected && <label className="field">复盘事件<select value={selected.id} onChange={(event) => onSelectEvent(event.target.value)}>{events.map((item) => <option key={item.id} value={item.id}>{item.event_type} · {item.area} · {item.status}</option>)}</select></label>}</div>
    {selected ? <><div className="metrics"><div className="metric"><span>响应等级</span><strong>{selected.response_level}</strong><small>{selected.status}</small></div><div className="metric"><span>任务完成率</span><strong>{linked.length ? Math.round(completed.length / linked.length * 100) : 0}%</strong><small>{completed.length}/{linked.length} 已完成</small></div><div className="metric"><span>超时未完</span><strong>{late.length}</strong><small>需在复盘中说明</small></div><div className="metric"><span>处置历时</span><strong>{Math.max(0, Math.round((referenceTime - new Date(selected.happened_at).getTime()) / 3_600_000))}</strong><small>小时（截至当前）</small></div></div>
      <div className="grid"><section className="panel"><h2>自动时间线</h2><div className="timeline"><article><b>事件发生</b><p>{selected.description}</p><small>{new Date(selected.happened_at).toLocaleString("zh-CN")}</small></article>{timeline.map((task) => <article key={task.id}><b>{task.title} · {task.status}</b><p>{task.feedback || `${task.assignee} · 时限 ${task.due_minutes} 分钟`}</p><small>{new Date(task.created_at).toLocaleString("zh-CN")}</small></article>)}</div></section>
        <form className="panel form" action={(form) => onAdd("reviews", form)}><h2>生成复盘记录</h2><label>标题<input name="title" required defaultValue={`${selected.event_type}·${selected.area}复盘`} /></label><label>分类<select name="recordType"><option>复盘报告</option><option>改进措施</option><option>演练评估</option></select></label><label>责任机构<input name="ownerOrg" defaultValue="区应急管理局" /></label><label>复盘摘要<textarea name="summary" rows={5} required defaultValue={`事件${selected.status}；任务完成${completed.length}/${linked.length}；超时未完成${late.length}条。`} /></label><input type="hidden" name="area" value={selected.area} /><input type="hidden" name="status" value="待审核" /><input type="hidden" name="sourceMode" value="real" /><input type="hidden" name="details" value={`eventId=${selected.id}`} /><button className="primary" disabled={!writable}>保存复盘初稿</button></form></div></> : <p className="empty">暂无事件可供复盘。</p>}
    {selected && <div className="grid"><form className="panel form" action={(form) => onAddIssue(selected.id, form)}><h2>新增问题与整改任务</h2><label>问题标题<input name="title" required /></label><label>问题说明<textarea name="description" rows={3} required /></label><label>责任单位<input name="responsibleOrganization" required /></label><label>责任人<select name="responsibleUserId"><option value="">暂不指定</option>{profiles.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.display_name || item.email}</option>)}</select></label><label>整改期限<input name="dueAt" type="datetime-local" /></label><button className="primary" disabled={!writable}>建立整改任务</button></form><section className="panel"><h2>整改闭环概览</h2><div className="summary-strip"><b>{issues.filter((item) => item.event_id === selected.id).length}</b><span>问题总数</span><b>{issues.filter((item) => item.event_id === selected.id && item.status !== "closed").length}</b><span>整改中</span><b>{issues.filter((item) => item.event_id === selected.id && item.status === "closed").length}</b><span>已销号</span></div><p className="muted">问题登记后依次进入整改、待复核、销号，销号必须填写复核结论。</p></section></div>}
    <section className="panel tablewrap"><h2>问题、整改与销号</h2><table><thead><tr><th>问题</th><th>责任单位/期限</th><th>状态</th><th>整改动作</th></tr></thead><tbody>{issues.filter((item) => !selected || item.event_id === selected.id).map((item) => <tr key={item.id}><td><b>{item.title}</b><p>{item.description}</p>{item.verification_note && <small>复核：{item.verification_note}</small>}</td><td>{item.responsible_organization}<br /><small>{item.due_at ? new Date(item.due_at).toLocaleString("zh-CN") : "未设期限"}</small></td><td><StatusBadge mode={item.status === "closed" ? "real" : "simulated"}>{item.status === "open" ? "待整改" : item.status === "rectifying" ? "整改中" : item.status === "pending_verification" ? "待复核" : "已销号"}</StatusBadge></td><td><button className={item.status === "pending_verification" ? "primary" : ""} disabled={!writable || item.status === "closed"} onClick={() => onProgressIssue(item, item.status === "pending_verification" ? window.prompt("填写销号复核结论") || "" : "")}>{item.status === "open" ? "开始整改" : item.status === "rectifying" ? "提交复核" : item.status === "pending_verification" ? "复核销号" : "已销号"}</button></td></tr>)}</tbody></table>{!issues.length && <p className="empty">尚未登记整改问题。</p>}</section>
    <section className="panel tablewrap"><h2>复盘报告与改进措施</h2><table><thead><tr><th>报告</th><th>类型/区域</th><th>状态</th><th>审核动作</th></tr></thead><tbody>{reviews.map((item) => <tr key={item.id}><td><b>{item.title}</b><p>{item.summary}</p></td><td>{item.record_type}<br /><small>{item.area} · {item.owner_org}</small></td><td><StatusBadge>{item.status}</StatusBadge></td><td><div className="actions"><button disabled={!writable || item.status === "已归档"} onClick={() => onUpdate(item, item.status === "待审核" ? "已通过" : "已归档")}>{item.status === "待审核" ? "审核通过" : "归档报告"}</button><button className="danger" disabled={!writable} onClick={() => onDelete(item)}>删除</button></div></td></tr>)}</tbody></table>{!reviews.length && <p className="empty">尚未生成复盘记录。</p>}</section>
  </>;
}
