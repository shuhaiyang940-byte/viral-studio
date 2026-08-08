import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const TIERS = ["free", "creator", "pro", "studio"] as const;
type Tier = (typeof TIERS)[number];

/**
 * 演示用的会员开通接口。
 *
 * 为什么需要它：前端 localStorage 里改 tier 是没用的——useSession 每次挂载都会
 * 回读 /api/auth/me（以数据库为准），本地假升级会被立刻冲掉，导致「支付页说解锁成功、
 * 导航栏还是免费」的分裂状态。要么两边都改，要么诚实地说没接支付。
 *
 * 所以：只有显式设置 ALLOW_DEMO_UPGRADE=1 时才允许免费开通（给演示/内测用）；
 * 正式环境不设这个变量，接口直接返回 403，前端如实提示「支付通道尚未接入」。
 * 绝不能默认开启，否则等于给所有人一个白嫖会员的后门。
 */
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_DEMO_UPGRADE !== "1") {
    return NextResponse.json(
      { error: "支付通道尚未接入，暂时无法开通会员" },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = String(body.tier ?? "") as Tier;
  if (!TIERS.includes(tier)) {
    return NextResponse.json({ error: "无效的会员等级" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  }

  try {
    const sql = getSql();
    await sql`UPDATE users SET tier = ${tier} WHERE id = ${user.id}`;
    return NextResponse.json({ ok: true, tier });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "开通失败" }, { status: 500 });
  }
}
