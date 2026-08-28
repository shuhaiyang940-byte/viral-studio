// 支付配置层（B 件：执照 + 商户号）——「真实支付就绪态」。
//
// 诚实边界：本模块只把「接入所需的一切」做齐（金额、凭证位、开关），
// 但**默认不激活真实收款**。是否可真实下单，由 PAYMENT_PROVIDER 是否配置决定：
//   - PAYMENT_PROVIDER=wechat 或 alipay 且有对应密钥 → 走真实下单；
//   - 未配置 → 走占位（PAYMENT_MODE=demo），前端如实提示「支付通道待接入」。
// 绝不默认返回一个"看起来已支付成功"的假订单。

export type PayProvider = "wechat" | "alipay" | "demo";

export const TIERS = ["free", "creator", "pro", "studio"] as const;
export type Tier = (typeof TIERS)[number];

/** 各档会员的真实定价（元）——与 /pricing 页保持一致 */
export const PRICE: Record<Exclude<Tier, "free">, number> = {
  creator: 29,
  pro: 99,
  studio: 299,
};

/** 支付渠道是否已接通（商户号 + 密钥都配齐才算接通） */
export function paymentProvider(): PayProvider {
  const p = String(process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (p === "wechat") {
    return process.env.WECHAT_MCH_ID && process.env.WECHAT_API_V3_KEY ? "wechat" : "demo";
  }
  if (p === "alipay") {
    return process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY ? "alipay" : "demo";
  }
  return "demo";
}

export function isPayEnabled(): boolean {
  return paymentProvider() !== "demo";
}

export function payDisplayName(): string {
  const p = paymentProvider();
  return p === "wechat" ? "微信支付" : p === "alipay" ? "支付宝" : "待接入";
}

export interface OrderResult {
  ok: boolean;
  /** 占位（未接真实支付时）为 false，前端据此显示"待接入" */
  orderId?: string;
  qrCodeUrl?: string;
  mode: "real" | "demo";
  error?: string;
}
