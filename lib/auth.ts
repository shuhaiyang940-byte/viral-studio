"use client";

/**
 * Mock 微信登录体系（本地演示版）。
 *
 * 现实里微信登录需要「微信开放平台」的 AppID / AppSecret + 后端换 code 拿 access_token，
 * 再落地成你自己的用户体系（数据库 + JWT/Session）。这里用 localStorage 模拟整个流程，
 * 让你在 Demo 里跑通「扫码 → 拿到微信身份 → 建立会话」的完整体验，但**不接触任何真实凭证**。
 *
 * 切换真实微信登录的入口（占位说明，勿删）：
 * 1. 在微信开放平台创建网站应用，拿到 AppID。
 * 2. 前端跳转 https://open.weixin.qq.com/connect/qrconnect?appid=...&redirect_uri=...&scope=snsapi_login
 * 3. 后端用 code 调 /sns/oauth2/access_token 换 access_token + openid。
 * 4. 用 openid 在自家用户表 upsert，下发 Session（HttpOnly Cookie / JWT）。
 * 5. 把下面 getSession() 换成读后端下发的 Cookie，logout() 调后端销毁会话。
 */

export type Tier = "free" | "pro" | "premium";

export interface Session {
  /** 本站用户 id（真实场景来自自家用户表，这里用 wx- 前缀模拟） */
  userId: string;
  /** 昵称（真实场景来自微信 userInfo.nickname） */
  name: string;
  /** 头像首字（真实场景是微信头像 url） */
  avatar: string;
  /** 登录方式，目前只有微信 */
  provider: "wechat";
  /** 是否付费会员（pro / premium 均为 true） */
  isPro: boolean;
  /** 会员等级 */
  tier: Tier;
  /** 会话建立时间 */
  createdAt: string;
  /** 绑定手机号（双重注册：微信登录后按法规要求补绑，Demo 存本地） */
  phone?: string;
}

const LS_KEY = "viralstudio:session";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, val: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* 隐私模式 / 配额满：静默失败，主流程不依赖它 */
  }
}

function randomSuffix(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

/** SSR 安全的会话读取；服务端或未登录均返回 null */
export function getSession(): Session | null {
  const raw = safeGet(LS_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (s && s.userId && s.provider === "wechat") return s;
    return null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

/** 模拟「已注册用户扫码授权」——有旧会话则复用，没有则按微信身份建一个 */
export function login(): Session {
  const existing = getSession();
  if (existing) return existing;
  const session: Session = {
    userId: "wx-" + randomSuffix(8),
    name: "微信用户" + randomSuffix(4),
    avatar: "微",
    provider: "wechat",
    isPro: false,
    tier: "free",
    createdAt: new Date().toISOString(),
  };
  safeSet(LS_KEY, JSON.stringify(session));
  return session;
}

/** 模拟「首次微信扫码 = 注册」——总是建立一个新的本站账号 */
export function register(name?: string): Session {
  const session: Session = {
    userId: "wx-" + randomSuffix(8),
    name: name?.trim() || "微信用户" + randomSuffix(4),
    avatar: (name?.trim() || "微").slice(0, 1),
    provider: "wechat",
    isPro: false,
    tier: "free",
    createdAt: new Date().toISOString(),
  };
  safeSet(LS_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Demo 用：一键切换会员等级，方便演示「锁定 → 解锁」效果 */
export function upgradeSession(tier: Tier = "pro"): Session | null {
  const s = getSession();
  if (!s) return null;
  const next: Session = {
    ...s,
    isPro: tier !== "free",
    tier,
  };
  safeSet(LS_KEY, JSON.stringify(next));
  return next;
}

/**
 * 双重注册：微信登录/注册后补绑手机号（法规要求）。
 * 真实环境这一步应走后端校验短信验证码并写入数据库 users.phone，
 * 这里仅把手机号记录到本地会话，便于 Demo 展示「已绑定」状态。
 */
export function bindPhone(phone: string): Session | null {
  const s = getSession();
  if (!s) return null;
  const next: Session = { ...s, phone: phone.trim() };
  safeSet(LS_KEY, JSON.stringify(next));
  return next;
}
