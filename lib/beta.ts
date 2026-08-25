/**
 * Beta 公测开关（NEXT_PUBLIC_* 会在构建时注入浏览器，客户端与服务端都能读）。
 *
 * true  = 全站处于「Beta 公测 · 核心创作功能限时免费」状态。
 *         用于让 UI 商业文案与真实的免费公测保持一致（套餐卡改为公测说明、价格/购买按钮隐藏）。
 *
 * false = 恢复正常会员方案展示（未来正式收费后使用）。
 *
 * 该变量只控制「商业状态表达」，不影响服务端权限 / 配额 / Pro Gate 逻辑。
 */
export const BETA_OPEN =
  process.env.NEXT_PUBLIC_BETA_MODE === "1";
