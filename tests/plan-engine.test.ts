import { describe, expect, it } from "vitest";
import { demoEvent } from "@/lib/demo-data";
import { demoPlans, demoPlanVersions } from "@/lib/plan-demo";
import { parseTaskTemplates, rankPlans, scorePlan } from "@/lib/plan-engine";

describe("professional plan engine", () => {
  it("ranks a published plan with an explainable weighted score", () => {
    const ranked = rankPlans(demoEvent, demoPlans, demoPlanVersions);
    expect(ranked[0].plan.code).toBe("XH-YA-BY-001");
    expect(ranked[0].score).toBe(100);
    expect(ranked[0].reasons).toEqual(expect.arrayContaining([expect.stringContaining("事件类型匹配"), expect.stringContaining("关键词命中")]));
  });

  it("does not recommend draft or retired plans", () => {
    const ranked = rankPlans(demoEvent, demoPlans.map((plan) => ({ ...plan, status: "retired" as const })), demoPlanVersions);
    expect(ranked).toHaveLength(0);
  });

  it("uses the configured weights instead of hard-coded scoring", () => {
    const result = scorePlan(demoEvent, demoPlans[0], { ...demoPlanVersions[0], type_weight: 20, level_weight: 20, keyword_weight: 60 });
    expect(result.score).toBe(100);
  });

  it("parses ordered task templates", () => {
    let counter = 0;
    const templates = parseTaskTemplates("核查|属地|终端|15\n调度|保障组|物资|30", "v1", () => `id-${++counter}`, "now");
    expect(templates).toMatchObject([{ title: "核查", due_minutes: 15, sort_order: 1 }, { title: "调度", due_minutes: 30, sort_order: 2 }]);
  });
});
