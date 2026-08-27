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

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const assetId = String(body.assetId || "").trim();
  const title = String(body.title || "").trim().slice(0, 120);
  const note = String(body.note || "").trim().slice(0, 1000);
  const m = (body.metrics || {}) as ReviewMetrics;
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
