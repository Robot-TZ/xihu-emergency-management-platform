import type { EmergencyPlan, EventRecord, PlanTaskTemplate, PlanVersion } from "@/lib/types";

export type PlanRecommendation = {
  plan: EmergencyPlan;
  version: PlanVersion;
  score: number;
  reasons: string[];
  matchedKeywords: string[];
};

function normalizeLevel(value: string) {
  return value.toUpperCase().replaceAll("Ⅰ", "I").replaceAll("Ⅱ", "II").replaceAll("Ⅲ", "III").replaceAll("Ⅳ", "IV").replaceAll(" ", "");
}

export function scorePlan(event: EventRecord, plan: EmergencyPlan, version: PlanVersion): PlanRecommendation {
  const matchedKeywords = version.keywords.filter((keyword) => keyword && event.description.includes(keyword));
  const typeMatched = plan.event_type === event.event_type;
  const eventLevel = normalizeLevel(event.response_level);
  const levelMatched = version.response_levels.some((level) => normalizeLevel(level) === eventLevel);
  const keywordMatched = matchedKeywords.length > 0;
  const score = (typeMatched ? version.type_weight : 0)
    + (levelMatched ? version.level_weight : 0)
    + (keywordMatched ? version.keyword_weight : 0);
  return {
    plan,
    version,
    score,
    matchedKeywords,
    reasons: [
      `事件类型${typeMatched ? "匹配" : "不匹配"}：${typeMatched ? "+" + version.type_weight : "+0"}`,
      `响应等级${levelMatched ? "匹配" : "不匹配"}：${levelMatched ? "+" + version.level_weight : "+0"}`,
      `关键词${keywordMatched ? `命中 ${matchedKeywords.join("、")}` : "未命中"}：${keywordMatched ? "+" + version.keyword_weight : "+0"}`,
    ],
  };
}

export function rankPlans(event: EventRecord, plans: EmergencyPlan[], versions: PlanVersion[]) {
  return plans
    .filter((plan) => plan.status === "published")
    .flatMap((plan) => {
      const version = versions.find((item) => item.id === plan.current_version_id && item.status === "published");
      return version ? [scorePlan(event, plan, version)] : [];
    })
    .sort((a, b) => b.score - a.score || b.version.version_no - a.version.version_no);
}

export function parseTaskTemplates(value: string, versionId: string, createId: () => string, createdAt: string): PlanTaskTemplate[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [title, assigneeRole = "应急处置组", resourceRequirement = "", due = "30"] = line.split("|").map((item) => item.trim());
    return {
      id: createId(),
      version_id: versionId,
      title,
      assignee_role: assigneeRole,
      resource_requirement: resourceRequirement,
      due_minutes: Math.max(1, Number(due) || 30),
      sort_order: index + 1,
      created_at: createdAt,
    };
  });
}
