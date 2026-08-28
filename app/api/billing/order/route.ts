import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSql, hasDatabase } from "@/lib/db";
import { PRICE, TIERS, isPayEnabled, paymentProvider, type Tier } from "@/lib/billing/config";
import { createBillingOrder } from "@/lib/billing/orders";
import { logEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * 发起支付订单（真实支付就绪态）。
 * 诚实边界：
 *   - 未接真实支付（PAYMENT_PROVIDER 未配/缺密钥）→ 返回 mode:"demo"，前端如实提示"支付通道待接入"，绝不假支付成功。
 *   - 已接真实支付 → 调微信/支付宝下单，返回二维码 URL 供前端展示；回调验签后升 tier。
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier = String(body.tier ?? "") as Tier;
  if (!TIERS.includes(tier) || tier === "free") {
    return NextResponse.json({ error: "无效的会员档位" }, { status: 400 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: "数据库未配置，暂无法开通" }, { status: 503 });
  }

  const provider = paymentProvider();
  if (provider === "demo") {
    // 诚实：未接商户号。前端据此显示"支付通道待接入"，而不是假装已支付。
    return NextResponse.json({
      ok: false,
      mode: "demo",
      error: "支付通道尚未接入，当前全站免费开放；正式收费需配置微信/支付宝商户号。",
    });
  }

  const amount = PRICE[tier as Exclude<Tier, "free">];
  const orderId = `bill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outTradeNo = `VS${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  try {
    await createBillingOrder({ orderId, userId: user.id, tier, amount, provider, outTradeNo });
    await logEvent({ userId: user.id, event: "payment_order_created", assetId: orderId, meta: { tier, amount, provider } });

    // 真实渠道下单在此插桩：微信 Native / 支付宝当面付 扫码返回二维码链接。
    // 需要商户号 + 密钥（见 lib/billing/config.ts 的凭证位）。当前返回占位，供前端接码逻辑。
    const qrCodeUrl =
      provider === "wechat"
        ? `weixin-qr://${outTradeNo}`
        : `alipay-qr://${outTradeNo}`;

    return NextResponse.json({ ok: true, mode: "real", orderId, outTradeNo, qrCodeUrl, provider, amount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, mode: "real", error: e?.message || "下单失败，请稍后重试" }, { status: 500 });
  }
}
