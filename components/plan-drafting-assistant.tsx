"use client";

import { useMemo, useState } from "react";
import type { GeneratedPlanDraft } from "@/lib/plan-drafting";
import type { EmergencyPlan, EventRecord, PlanTaskTemplate, PlanVersion } from "@/lib/types";
import { StatusBadge } from "./product-pages";

type DraftResponse = { draft?: GeneratedPlanDraft; model?: string; totalTokens?: number | null; error?: string };

export function PlanDraftingAssistant({ plans, versions, templates, events, activeEventId, writable, onApply }: {
  plans: EmergencyPlan[];
  versions: PlanVersion[];
  templates: PlanTaskTemplate[];
  events: EventRecord[];
  activeEventId?: string;
  writable: boolean;
  onApply: (version: PlanVersion, draft: GeneratedPlanDraft) => Promise<boolean> | boolean;
}) {
  const candidates = useMemo(() => versions.filter((version) => version.status === "draft" && plans.some((plan) => plan.id === version.plan_id)).sort((a, b) => b.version_no - a.version_no), [plans, versions]);
  const [versionId, setVersionId] = useState(candidates[0]?.id || "");
  const [eventId, setEventId] = useState(activeEventId || "");
  const [instructions, setInstructions] = useState("");
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<GeneratedPlanDraft | null>(null);
  const [status, setStatus] = useState("");
  const [modelInfo, setModelInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedVersionId = candidates.some((item) => item.id === versionId) ? versionId : candidates[0]?.id || "";
  const version = candidates.find((item) => item.id === selectedVersionId);
  const plan = version ? plans.find((item) => item.id === version.plan_id) : undefined;
  const event = events.find((item) => item.id === eventId);
  const versionTemplates = version ? templates.filter((item) => item.version_id === version.id).sort((a, b) => a.sort_order - b.sort_order) : [];

  async function generate() {
    if (!plan || !version || !consent || loading) return;
    setLoading(true); setStatus("正在结合预案资料生成初稿，请勿关闭页面……"); setModelInfo("");
    try {
      const response = await fetch("/api/ai/plan-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          version,
          templates: versionTemplates,
          event,
          instructions,
          consent,
        }),
      });
      const payload = await response.json() as DraftResponse;
      if (!response.ok || !payload.draft) throw new Error(payload.error || "AI 生成失败，请稍后重试。");
      setDraft(payload.draft);
      setStatus("初稿已生成。请逐项核对和修改，确认后再保存到预案草稿。");
      setModelInfo(`${payload.model || "DeepSeek"}${payload.totalTokens ? ` · ${payload.totalTokens} tokens` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 生成失败，请稍后重试。");
    } finally { setLoading(false); }
  }

  async function apply() {
    if (!version || !draft) return;
    const saved = await onApply(version, draft);
    setStatus(saved ? "人工修改后的内容已保存到当前草稿；仍需按原流程送审和发布。" : "保存失败，AI 结果仍保留在工作台，请按页面提示处理后重试。");
  }

  return <section className="panel ai-plan-assistant" aria-labelledby="ai-plan-title" aria-busy={loading}>
    <div className="ai-plan-heading"><div><span className="eyebrow">HUMAN-IN-THE-LOOP DRAFTING</span><h2 id="ai-plan-title">AI 预案初稿助手</h2><p>读取所选草稿版本、任务模板和可选事件信息，生成可人工编辑的初稿；不会自动送审或发布。</p></div><StatusBadge mode="external">DeepSeek · 人工复核</StatusBadge></div>
    {!candidates.length ? <div className="ai-empty"><b>当前没有可编辑的草稿版本</b><p>请先新建预案草稿，或对已发布预案执行“复制新版本”，再使用 AI 起草。</p></div> : <div className="ai-plan-grid">
      <div className="ai-plan-context form">
        <h3>1. 选择依据与补充信息</h3>
        <label>目标草稿版本<select value={selectedVersionId} onChange={(change) => { setVersionId(change.target.value); setDraft(null); setStatus(""); }}>{candidates.map((item) => { const itemPlan = plans.find((candidate) => candidate.id === item.plan_id); return <option value={item.id} key={item.id}>{itemPlan?.title || "未命名预案"} · V{item.version_no}</option>; })}</select></label>
        <label>关联事件（可选）<select value={eventId} onChange={(change) => setEventId(change.target.value)}><option value="">不关联具体事件</option>{events.map((item) => <option value={item.id} key={item.id}>{item.event_type} · {item.area} · {item.response_level}</option>)}</select></label>
        <label>操作员补充要求<textarea rows={5} maxLength={3000} value={instructions} onChange={(change) => setInstructions(change.target.value)} placeholder="例如：突出景区游客疏散、夜间值守和断电情况下的信息报送；未知联系人统一标注待核实。" /><small>{instructions.length}/3000 字</small></label>
        <details className="ai-source-preview"><summary>查看将发送给 AI 的资料范围</summary><dl><div><dt>预案</dt><dd>{plan?.code} · {plan?.title} · {plan?.event_type} · {plan?.area}</dd></div><div><dt>当前版本</dt><dd>摘要、处置正文、响应等级、关键词</dd></div><div><dt>任务模板</dt><dd>{versionTemplates.length} 条（任务、责任角色、资源要求、时限）</dd></div><div><dt>关联事件</dt><dd>{event ? `${event.event_type} · ${event.area} · ${event.response_level} · ${event.description}` : "未选择，不发送事件资料"}</dd></div></dl></details>
        <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(change) => setConsent(change.target.checked)} /><span>我确认上述资料不包含国家秘密、工作秘密或无授权的个人敏感信息，并同意将其发送给第三方 DeepSeek 模型生成草稿。</span></label>
        <button type="button" className="primary" disabled={!writable || !version || !consent || loading} onClick={generate}>{loading ? "正在生成……" : draft ? "重新生成初稿" : "生成预案初稿"}</button>
        {!writable && <small>viewer 角色只能查看，member 或 admin 才能调用并保存 AI 草稿。</small>}
      </div>
      <div className="ai-draft-workbench form">
        <div className="ai-workbench-title"><h3>2. 人工编辑工作台</h3>{modelInfo && <small>{modelInfo}</small>}</div>
        {!draft ? <div className="ai-workbench-placeholder"><b>生成结果将在此处出现</b><p>AI 内容只是初稿。保存前请核对法律依据、职责单位、联系方式、时限和资源能力。</p></div> : <>
          <label>预案摘要<textarea rows={4} maxLength={2000} value={draft.summary} onChange={(change) => setDraft({ ...draft, summary: change.target.value })} /></label>
          <label>处置正文<textarea rows={16} maxLength={20000} value={draft.content} onChange={(change) => setDraft({ ...draft, content: change.target.value })} /></label>
          <label>响应等级<input value={draft.responseLevels.join(",")} onChange={(change) => setDraft({ ...draft, responseLevels: change.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 10) })} /></label>
          <label>关键词<input value={draft.keywords.join(",")} onChange={(change) => setDraft({ ...draft, keywords: change.target.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 20) })} /></label>
          <div className="ai-review-warning"><b>保存前检查</b><span>清除或补实所有“【待核实】”；AI 可能出错，最终责任由审核人员承担。</span></div>
          <button type="button" className="primary" disabled={!writable || loading || !draft.summary.trim() || !draft.content.trim()} onClick={apply}>保存人工修订稿</button>
        </>}
      </div>
    </div>}
    {status && <p className="ai-status" role="status" aria-live="polite">{status}</p>}
  </section>;
}
