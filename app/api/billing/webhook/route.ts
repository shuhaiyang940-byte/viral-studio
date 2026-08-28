import { NextRequest, NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { isPayEnabled, paymentProvider } from "@/lib/billing/config";
import { getOrder, ensureOrdersSchema, markOrderPaid } from "@/lib/billing/orders";
import { logEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * 支付异步回调（微信 Native / 支付宝当面付）。
 * 诚实边界：
 *   - 未接真实支付（PAYMENT_PROVIDER 未配/缺密钥）→ 回调直接拒绝，绝不假确认。
 *   - 已接真实支付 → 在此验签（需接微信 v3 / 支付宝 SDK），验签通过后幂等升 tier。
 */
export async function POST(req: NextRequest) {
  if (!isPayEnabled() || !hasDatabase()) {
    return NextResponse.json({ code: "PAY_NOT_CONFIGURED", message: "支付通道未接通" }, { status: 400 });
  }
  const provider = paymentProvider();
  const raw = await req.text().catch(() => "");
  if (!raw) return NextResponse.json({ code: "EMPTY_BODY" }, { status: 400 });

  // ---- 真实验签插桩位 ----
  // wechat: 用 WECHAT_API_V3_KEY + WECHAT_MCH_ID 验 V3 回调签名；
  // alipay: 用 ALIPAY_PUBLIC_KEY 验异步通知 RSA2 签名。
  // 当前未接 SDK，保守返回「无法验签」，不升 tier、不掉单泄漏金额。
  // 将来接入时在 /lib/billing/verify.ts 实现 verifyWebhook(provider, raw, headers)，此处调用。
  const verified = false;
  if (!verified) {
    return NextResponse.json({ code: "VERIFY_NOT_IMPLEMENTED", message: "支付回调验签尚未接入，订单未确认" }, { status: 501 });
  }

  // 以下为验签通过后的幂等升 tier（当前代码路径不可达，留作接入后的落点）
  await ensureOrdersSchema();
  const orderId = req.nextUrl.searchParams.get("orderId") || "";
  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ code: "ORDER_NOT_FOUND" }, { status: 404 });
  const paid = await markOrderPaid(orderId);
  if (!paid) return NextResponse.json({ code: "ORDER_ALREADY_PAID" }, { status: 200 });
  if (order.tier === "studio" || order.tier === "pro" || order.tier === "creator") {
    const sql = getSql();
    await sql.query(`UPDATE users SET tier = $1 WHERE id = $2`, [order.tier, order.userId]);
    await logEvent({ userId: order.userId, event: "payment_paid", assetId: orderId, meta: { tier: order.tier, amount: order.amount } });
  }
  return NextResponse.json({ code: "SUCCESS", message: "ok" });
}
