import { buildPlanDraftPrompt, normalizePlanDraftContext, parseGeneratedPlanDraft } from "@/lib/plan-drafting";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rateLimits = new Map<string, number[]>();

function isRateLimited(userId: string) {
  const now = Date.now();
  const recent = (rateLimits.get(userId) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return true;
  recent.push(now);
  rateLimits.set(userId, recent);
  return false;
}

function errorMessage(status: number) {
  if (status === 401) return "DeepSeek 服务端密钥无效，请管理员更新配置。";
  if (status === 402) return "DeepSeek 账户余额不足，请管理员充值后重试。";
  if (status === 429) return "AI 请求过于频繁，请稍后重试。";
  if (status === 400 || status === 422) return "AI 无法处理当前资料，请精简补充说明后重试。";
  return "AI 服务暂时不可用，草稿未被修改，请稍后重试。";
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "拒绝跨站请求。" }, { status: 403 });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ error: "AI 服务尚未配置，请联系管理员。" }, { status: 503 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
  if (!userId) return Response.json({ error: "登录已失效，请重新登录。" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", userId).single();
  if (!profile?.active || !["member", "admin"].includes(profile.role)) {
    return Response.json({ error: "当前账号没有 AI 起草权限。" }, { status: 403 });
  }
  if (isRateLimited(userId)) return Response.json({ error: "一分钟最多生成 5 次，请稍后重试。" }, { status: 429 });

  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "请求格式错误。" }, { status: 400 }); }
  const context = normalizePlanDraftContext(input);
  if (!context) return Response.json({ error: "资料不完整，或尚未确认数据发送授权。" }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
        messages: [
          { role: "system", content: "你是中国基层应急管理预案起草助手。严格区分已知资料和待核实信息，只生成供人工复核的草稿，并严格输出 JSON。" },
          { role: "user", content: buildPlanDraftPrompt(context) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 6000,
        user_id: userId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return Response.json({ error: errorMessage(response.status) }, { status: response.status === 429 ? 429 : 502 });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }>; model?: string; usage?: { total_tokens?: number } };
    const draft = parseGeneratedPlanDraft(payload.choices?.[0]?.message?.content);
    if (!draft) return Response.json({ error: "AI 返回内容格式异常，草稿未被修改，请重新生成。" }, { status: 502 });
    return Response.json({ draft, model: payload.model || process.env.DEEPSEEK_MODEL || "deepseek-flash", totalTokens: payload.usage?.total_tokens || null });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "AI 生成超时，草稿未被修改，请重试。" : "连接 AI 服务失败，草稿未被修改，请稍后重试。";
    return Response.json({ error: message }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
