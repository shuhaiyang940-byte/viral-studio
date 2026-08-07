/**
 * 真实登录骨架（占位 / 待接入后端）
 * ──────────────────────────────────────────────────────────────────
 * 当前线上 Demo 用的是 lib/auth.ts 的 Mock 版（localStorage 模拟微信登录）。
 * 下面这套是「真实微信登录 + 自家用户体系 + JWT 会话」的骨架，
 * 上线前需要补齐：微信开放平台 AppID/AppSecret、数据库、密钥管理。
 *
 * 真实链路（微信网站应用 snsapi_login）：
 *   1. 前端：跳 open.weixin.qq.com/connect/qrconnect
 *        ?appid=APPID&redirect_uri=后端/callback&response_type=code&scope=snsapi_login&state=xxx
 *   2. 用户扫码授权 → 微信带着 code 跳回 redirect_uri（你的后端）
 *   3. 后端 /api/auth/wechat：用 code 调 /sns/oauth2/access_token 换 access_token + openid
 *   4. 用 access_token 调 /sns/userinfo 拿 nickname / avatar
 *   5. 用 openid 在自家 users 表 upsert（首次即注册，之后即登录）
 *   6. 下发会话：HttpOnly Cookie 存 JWT（含 userId / tier），前端不再碰明文
 *   7. 前端读登录态 → 调 /api/auth/session（后端验 JWT 返回 user）
 *
 * 双重注册：第 5 步若检测到该微信未绑定手机号 → 返回 needsPhone=true，
 *   前端弹「绑定手机号」并调 /api/auth/bind-phone（校验短信验证码后写库）。
 *   （Demo 里这套用 lib/auth.ts 的 bindPhone + localStorage 代替，见 app/login/page.tsx）
 */

export type RealTier = "free" | "pro" | "premium";

export interface RealUser {
  /** 自家用户表主键 */
  id: string;
  /** 微信 openid（唯一，用于 upsert） */
  wechatOpenid: string;
  nickname: string;
  avatar: string;
  /** 双重注册：法规要求绑定手机号 */
  phone?: string;
  tier: RealTier;
  createdAt: string;
}

export interface WechatOAuthConfig {
  appId: string;
  appSecret: string;
  /** 后端回调地址，需在微信开放平台配置 */
  redirectUri: string;
  /** JWT 签名密钥，从环境变量读取，绝不写死在前端 */
  jwtSecret: string;
}

/**
 * 真实配置从 .env 读取。这里放 null 表示「未接入」，
 * 任何真实函数被调用都会明确报错，避免 Demo 误以为已上线。
 */
const CONFIG: WechatOAuthConfig | null = null;
// 接入示例（填写后取消注释，并改用 process.env）：
// const CONFIG: WechatOAuthConfig = {
//   appId: process.env.WX_APPID!,
//   appSecret: process.env.WX_APPSECRET!,
//   redirectUri: process.env.WX_REDIRECT_URI!,
//   jwtSecret: process.env.JWT_SECRET!,
// };

/** 第一步：拼出微信扫码授权 URL（前端跳转用） */
export function buildWechatAuthUrl(state: string): string {
  if (!CONFIG) throw new Error("未配置微信开放平台 AppID（见 .env 的 WX_APPID）");
  const u = new URL("https://open.weixin.qq.com/connect/qrconnect");
  u.searchParams.set("appid", CONFIG.appId);
  u.searchParams.set("redirect_uri", CONFIG.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "snsapi_login");
  u.searchParams.set("state", state);
  return u.toString();
}

/** 第三步：用 code 换 access_token + openid（必须在后端执行，AppSecret 不能泄露到前端） */
export async function exchangeWechatCode(
  code: string
): Promise<{ accessToken: string; openid: string }> {
  if (!CONFIG) throw new Error("未接入真实后端：需微信 AppSecret 在服务端换 token");
  const res = await fetch("https://api.weixin.qq.com/sns/oauth2/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appid: CONFIG.appId,
      secret: CONFIG.appSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; openid?: string };
  if (data.errcode) throw new Error(`微信换 token 失败：${data.errmsg}`);
  return { accessToken: data.access_token!, openid: data.openid! };
}

/** 第五步：用 openid upsert 自家用户（首次即注册，之后即登录） */
export async function upsertUser(
  openid: string,
  userInfo: { nickname: string; avatar: string }
): Promise<{ user: RealUser; needsPhone: boolean }> {
  // TODO: 接数据库（Prisma / Drizzle 等），示意：
  // const existing = await db.user.findUnique({ where: { wechatOpenid: openid } });
  // const user = existing ?? await db.user.create({ data: { wechatOpenid: openid, ...userInfo, tier: "free" } });
  // return { user, needsPhone: !user.phone };
  throw new Error("未接入数据库：upsertUser 需在服务端实现（见本文件注释）");
}

/** 第六步：签发会话 JWT（HttpOnly Cookie，前端不接触密钥） */
export function issueSession(user: RealUser): string {
  // TODO: 用 jwt 库 + CONFIG.jwtSecret 签发；真实环境在 route handler 里 set-cookie
  // return jwt.sign({ sub: user.id, tier: user.tier }, CONFIG.jwtSecret, { expiresIn: "30d" });
  throw new Error("未接入 JWT 签发：需在服务端用密钥签名（见本文件注释）");
}

/** 第七步：校验会话 JWT，返回当前用户（供 /api/auth/session 使用） */
export function verifySession(token: string): RealUser | null {
  // TODO: 用 jwt 库验签并返回 payload 对应的 user
  void token;
  throw new Error("未接入 JWT 校验：需在服务端实现（见本文件注释）");
}
