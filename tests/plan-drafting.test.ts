import { describe, expect, it } from "vitest";
import { buildPlanDraftPrompt, normalizePlanDraftContext, parseGeneratedPlanDraft } from "@/lib/plan-drafting";

const validInput = {
  plan: { code: "XH-YA-001", title: "暴雨预案", event_type: "暴雨内涝", area: "全区" },
  version: { version_no: 1, summary: "原摘要", content: "原正文", response_levels: ["II级"], keywords: ["积水"] },
  templates: [{ title: "现场核查", assignee_role: "属地街道", resource_requirement: "移动终端", due_minutes: 15, sort_order: 1 }],
  event: { event_type: "暴雨内涝", response_level: "II级", area: "西湖区", happened_at: "2026-10-09T10:00:00+08:00", description: "道路积水", address: "测试路段" },
  instructions: "未知信息标记待核实",
  consent: true,
};

describe("plan drafting boundary", () => {
  it("requires explicit data-transfer consent and trims oversized input", () => {
    expect(normalizePlanDraftContext({ ...validInput, consent: false })).toBeNull();
    const normalized = normalizePlanDraftContext({ ...validInput, instructions: "a".repeat(5000) });
    expect(normalized?.instructions).toHaveLength(3000);
    expect(normalized?.templates).toHaveLength(1);
  });

  it("marks source content as untrusted data and requires unknown facts to be flagged", () => {
    const context = normalizePlanDraftContext(validInput);
    expect(context).not.toBeNull();
    const prompt = buildPlanDraftPrompt(context!);
    expect(prompt).toContain("业务数据");
    expect(prompt).toContain("【待核实】");
    expect(prompt).toContain("现场核查");
  });

  it("accepts valid JSON or fenced JSON and rejects incomplete output", () => {
    const expected = { summary: "摘要", content: "正文", responseLevels: ["II级"], keywords: ["积水"] };
    expect(parseGeneratedPlanDraft(JSON.stringify(expected))).toEqual(expected);
    expect(parseGeneratedPlanDraft(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``)).toEqual(expected);
    expect(parseGeneratedPlanDraft('{"summary":"只有摘要"}')).toBeNull();
  });
});
