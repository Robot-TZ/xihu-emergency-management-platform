"use client";

import { useMemo, useState } from "react";
import { rankPlans } from "@/lib/plan-engine";
import type { EmergencyPlan, EventRecord, PlanTaskTemplate, PlanVersion } from "@/lib/types";
import { StatusBadge } from "./product-pages";

export type PlanLifecycleAction = "submit" | "publish" | "copy" | "retire";

const planStatusText: Record<EmergencyPlan["status"], string> = {
  draft: "草稿", review: "待审核", published: "已发布", retired: "已作废",
};
const versionStatusText: Record<PlanVersion["status"], string> = {
  draft: "草稿", review: "待审核", published: "已发布", archived: "历史版本",
};

function latestVersion(planId: string, versions: PlanVersion[]) {
  return versions.filter((item) => item.plan_id === planId).sort((a, b) => b.version_no - a.version_no)[0];
}

export function PlanCenterPage({ plans, versions, templates, events, writable, admin, onAdd, onLifecycle, onDelete, onStart }: {
  plans: EmergencyPlan[];
  versions: PlanVersion[];
  templates: PlanTaskTemplate[];
  events: EventRecord[];
  writable: boolean;
  admin: boolean;
  onAdd: (form: FormData) => void;
  onLifecycle: (plan: EmergencyPlan, version: PlanVersion, action: PlanLifecycleAction) => void;
  onDelete: (plan: EmergencyPlan) => void;
  onStart: (event: EventRecord, plan: EmergencyPlan, version: PlanVersion, templates: PlanTaskTemplate[]) => void;
}) {
  const [eventId, setEventId] = useState("");
  const event = events.find((item) => item.id === eventId) || events[0];
  const recommendations = useMemo(() => event ? rankPlans(event, plans, versions) : [], [event, plans, versions]);

  return <>
    <div className="pagehead"><div><span className="eyebrow">PROFESSIONAL PLAN CENTER</span><h1>预案中心</h1><p>独立预案建模、版本送审发布、可解释匹配和任务模板执行。</p></div><StatusBadge>{plans.filter((item) => item.status === "published").length} 项已发布</StatusBadge></div>
    <div className="grid">
      <form className="panel form" action={onAdd}>
        <h2>新建预案草稿</h2>
        <label>预案编码<input name="code" required placeholder="XH-YA-BY-002" /></label>
        <label>预案名称<input name="title" required /></label>
        <label>事件类型<select name="eventType"><option>暴雨内涝</option><option>台风</option><option>城市安全事件</option><option>地质灾害</option></select></label>
        <label>适用区域<input name="area" defaultValue="全区" /></label>
        <label>适用响应等级<input name="levels" defaultValue="II级,III级,IV级" /></label>
        <label>匹配关键词<input name="keywords" placeholder="积水,强降雨,转移" /></label>
        <label>预案摘要<textarea name="summary" rows={2} required /></label>
        <label>处置要点<textarea name="content" rows={3} required /></label>
        <div className="weight-grid"><label>类型权重<input name="typeWeight" type="number" min="0" max="100" defaultValue="50" /></label><label>等级权重<input name="levelWeight" type="number" min="0" max="100" defaultValue="30" /></label><label>关键词权重<input name="keywordWeight" type="number" min="0" max="100" defaultValue="20" /></label></div>
        <label>任务模板<textarea name="tasks" rows={5} defaultValue={"现场核查|属地应急队|移动终端|15\n资源调度|物资保障组|按预案调配|30\n处置反馈|现场处置组||45"} /><small>每行：任务|责任角色|资源要求|时限分钟</small></label>
        <button className="primary" disabled={!writable}>创建草稿及 V1 版本</button>
      </form>
      <section className="panel"><h2>事件匹配与启动</h2>
        <label className="field">选择待研判事件<select value={event?.id || ""} onChange={(change) => setEventId(change.target.value)}>{events.map((item) => <option value={item.id} key={item.id}>{item.event_type} · {item.area} · {item.response_level}</option>)}</select></label>
        {!event && <p className="empty">请先在指挥调度中新增事件。</p>}
        {event && !recommendations.length && <p className="empty">暂无已发布且可匹配的预案。</p>}
        {recommendations.map((item) => {
          const versionTemplates = templates.filter((template) => template.version_id === item.version.id).sort((a, b) => a.sort_order - b.sort_order);
          return <article className="recommend" key={item.plan.id}><div><b>{item.plan.title} · V{item.version.version_no}</b><p>{item.reasons.join("；")}</p><small>启动后将生成 {versionTemplates.length} 条责任任务</small></div><div className="actions"><StatusBadge>{item.score}分</StatusBadge><button className="primary" disabled={!writable || item.score === 0 || !versionTemplates.length} onClick={() => onStart(event, item.plan, item.version, versionTemplates)}>人工确认并启动</button></div></article>;
        })}
      </section>
    </div>
    <section className="panel tablewrap"><h2>预案库与版本生命周期</h2><table><thead><tr><th>预案</th><th>最新版本</th><th>匹配规则</th><th>任务模板</th><th>操作</th></tr></thead><tbody>{plans.map((plan) => {
      const version = latestVersion(plan.id, versions); const versionTemplates = version ? templates.filter((item) => item.version_id === version.id) : [];
      return <tr key={plan.id}><td><b>{plan.title}</b><p>{plan.code} · {plan.event_type} · {plan.area}</p><StatusBadge>{planStatusText[plan.status]}</StatusBadge></td><td>{version ? <>V{version.version_no} · {versionStatusText[version.status]}<p>{version.summary}</p><details><summary>查看处置要点</summary><p>{version.content}</p></details></> : "无版本"}</td><td>{version && <><b>{version.type_weight}/{version.level_weight}/{version.keyword_weight}</b><p>{version.response_levels.join("、")}</p><small>{version.keywords.join("、") || "无关键词"}</small></>}</td><td>{versionTemplates.sort((a, b) => a.sort_order - b.sort_order).map((item) => <div key={item.id}>{item.sort_order}. {item.title} · {item.due_minutes}分钟</div>)}</td><td>{version && <div className="actions vertical-actions">{version.status === "draft" && <button disabled={!writable} onClick={() => onLifecycle(plan, version, "submit")}>送审</button>}{version.status === "review" && <button className="primary" disabled={!admin} onClick={() => onLifecycle(plan, version, "publish")}>审核发布</button>}{version.status === "published" && <button disabled={!writable} onClick={() => onLifecycle(plan, version, "copy")}>复制新版本</button>}{plan.status !== "retired" && <button disabled={!admin} onClick={() => onLifecycle(plan, version, "retire")}>作废</button>}<button disabled={!writable || (!admin && plan.status !== "draft")} onClick={() => onDelete(plan)}>删除</button></div>}</td></tr>;
    })}</tbody></table>{!plans.length && <p className="empty">暂无预案，请创建草稿。</p>}</section>
    <section className="panel dependency"><h2>语义匹配与动态调整</h2><StatusBadge mode="external">真实语料与验收基线待甲方提供</StatusBadge><p>当前规则引擎已支持版本化权重和逐项评分解释。NLP 模型仍需真实预案语料、历史事件及可验收的准确率指标，不使用虚构数据宣称智能化效果。</p></section>
  </>;
}
