import { NextRequest, NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";
import { getPersonaCard, addPersonaLearning } from "@/lib/persona";
import { runReview, type ReviewMetrics } from "@/lib/review";
import { consumeGenerationQuota, refundGenerationQuota } from "@/lib/quota-server";
import { getUserEntitlements } from "@/lib/permissions";
import { getAsset, saveAsset, listAssets } from "@/lib/assets";
import { logEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * 复盘字段契约（唯一事实源，与前端 /review 表单对齐）：
 *   assetId    string    可选  关联脚本资源 id
 *   title      string    可选  复盘标题（≤120 字符）
 *   note       string    可选  备注/说明（≤1000 字符；拒绝对象/中文键，保证不污染 LLM 上下文）
 *   metrics    object    可选  拍后数据，仅接受以下英文键：
 *                       plays / likes / comments / completionRate / follows / conversions
 *                       其余键（含中文键，如「播放」「点赞」）一律忽略，避免解析异常。
 */
const METRIC_KEYS = ["plays", "likes", "comments", "completionRate", "follows", "conversions"] as const;

/** 把 metrics 限制到白名单键，且只接受非负数字；未知/中文键直接丢弃 */
function sanitizeMetrics(raw: unknown): ReviewMetrics {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m: ReviewMetrics = {};
  for (const key of METRIC_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined || v === null || `${v}`.trim() === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) m[key] = n;
  }
  return m;
}

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "为了您的体验，请先登录", code: "UN_AUTHED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const assetId = String(body.assetId || "").trim();
  const title = String(body.title || "").trim().slice(0, 120);
  // note 必须是纯字符串：若传入对象/数组/中文键，直接 400，避免污染 LLM 上下文或解析异常
  if (body.note !== undefined && typeof body.note !== "string") {
    return NextResponse.json(
      { error: "note 字段必须是字符串（如需写备注，请用纯文本，不要用对象/中文键）", code: "INVALID_NOTE" },
      { status: 400 }
    );
  }
  const note = String(body.note || "").trim().slice(0, 1000);
  const m = sanitizeMetrics(body.metrics);
  const hasMetric =
    m.plays || m.likes || m.comments || m.completionRate || m.follows || m.conversions;
  if (!hasMetric && !note && !assetId) {
    return NextResponse.json({ error: "请至少填一项拍后数据（播放/点赞/评论/完播/涨粉/转化），否则没法复盘" }, { status: 400 });
  }

  const ent = await getUserEntitlements(user.id);
  const q = await consumeGenerationQuota(user.id, "review", ent.tier);
  if (!q.ok) return NextResponse.json({ error: "今日复盘次数已用完，请升级会员或明日再试", code: "QUOTA_EXCEEDED" }, { status: 429 });

  try {
    const personaCard = await getPersonaCard(user.id);
    const asset = assetId ? await getAsset(user.id, assetId) : null;
    const payload = (asset?.payload || {}) as any;
    const script = asset
      ? { title: payload.title || asset.title, hook: payload.hook, cta: payload.cta, body: payload.body }
      : null;

    const conclusion = await runReview({
      personaCard,
      script,
      metrics: m,
      note,
      platform: personaCard?.platform || "抖音",
    });

    const reviewId = `review:${user.id}:${Date.now()}`;
    await saveAsset({
      userId: user.id,
      type: "review",
      assetId: reviewId,
      parentAssetId: assetId || null,
      title: title || `复盘：${payload.hook || asset?.title || "某条作品"}`.slice(0, 120),
      status: "completed",
      payload: { metrics: m, note, sourceAssetId: assetId || null, conclusion },
    });

    if (conclusion.learning) {
      await addPersonaLearning(user.id, conclusion.learning);
    }
    await logEvent({ userId: user.id, event: "review_created", assetId: reviewId });

    return NextResponse.json({ conclusion, assetId: reviewId, learning: conclusion.learning || "" });
  } catch (e: any) {
    await refundGenerationQuota(user.id, "review");
    return NextResponse.json({ error: e?.message || "复盘失败，请重试" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 100);
  const { items } = await listAssets({ userId: user.id, type: "review", limit });
  return NextResponse.json({
    items: items.map((it) => ({
      id: it.assetId,
      title: it.title,
      createdAt: it.createdAt,
      payload: it.payload,
    })),
  });
}
