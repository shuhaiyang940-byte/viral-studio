"use client";

import * as React from "react";

/**
 * 客户端会话层（真实账号体系）。
 *
 * 设计：登录/注册/登出走 /api/auth/* 真实后端（邮箱+密码，密码哈希存库，会话为 HttpOnly Cookie 里的 JWT）。
 * 同时在本地点一份「非敏感 UI 镜像」（userId/name/avatar/tier，不含 token/密码）写入 localStorage，
 * 这样全站既有页面用 getSession() 同步读登录态的代码无需改动即可工作。
 * 任何需要真实数据的服务端写操作，都由后端校验 Cookie 完成，前端镜像不可伪造。
 */

export type Tier = "free" | "creator" | "pro" | "studio";

export interface Session {
  userId: string;
  name: string;
  avatar: string;
  provider: "email" | "phone" | "qq" | "wechat";
  isPro: boolean;
  tier: Tier;
  /** 邮箱是否已验证（仅邮箱账号有值） */
  emailVerified?: boolean;
  createdAt: string;
  email?: string;
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

function safeSet(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* 隐私模式/配额满：静默失败，登录态以服务端 Cookie 为准 */
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ── 响应式快照 ──────────────────────────────────────────────
// useSyncExternalStore 要求 getSnapshot 返回稳定引用，
// 所以按 localStorage 原始字符串做缓存，内容没变就返回同一个对象。
let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;
const listeners = new Set<() => void>();

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s && s.userId ? s : null;
  } catch {
    return null;
  }
}

function emit(): void {
  cachedRaw = undefined; // 强制下次重读
  listeners.forEach((l) => l());
}

/** SSR 安全：同步读 UI 镜像（无副作用，可用在 useState 初始化） */
export function getSession(): Session | null {
  const raw = safeGet(LS_KEY);
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  cachedSession = parseSession(raw);
  return cachedSession;
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

function mapUser(u: {
  id: string;
  email: string;
  name: string;
  tier: string;
  emailVerified?: boolean;
}): Session {
  const name = u.name?.trim() || u.email.split("@")[0];
  return {
    userId: u.id,
    email: u.email,
    name,
    avatar: name.slice(0, 1).toUpperCase(),
    provider: "email",
    isPro: u.tier !== "free",
    tier: (u.tier as Tier) || "free",
    emailVerified: u.emailVerified === true,
    createdAt: new Date().toISOString(),
  };
}

function persist(session: Session): Session {
  safeSet(LS_KEY, JSON.stringify(session));
  emit();
  return session;
}

function clearMirror(): void {
  safeRemove(LS_KEY);
  emit();
}

// 演示会话（手机 / QQ / 微信 mock）没有服务端 HttpOnly Cookie，
// 改用一枚客户端可读写的演示 Cookie，让 middleware 也能识别登录态。
// 注意：演示会话仅存于本地，刷新不会掉线，但换设备 / 清 Cookie 即失效。
const DEMO_COOKIE = "vs_demo_session";
function setDemoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}
function clearDemoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "请求失败") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/** 真实注册：邮箱 + 密码（+ 昵称） */
export async function register(email: string, password: string, name?: string): Promise<Session> {
  const data = await postJSON("/api/auth/register", { email, password, name });
  return persist(mapUser(data.user));
}

/** 真实登录：邮箱 + 密码 */
export async function login(email: string, password: string): Promise<Session> {
  const data = await postJSON("/api/auth/login", { email, password });
  return persist(mapUser(data.user));
}

/**
 * 手机号登录 / 注册（演示）：短信验证码在沙箱里无法真实下发，
 * 这里只做前端校验（手机号合法 + 6 位验证码），不调用任何后端。
 * 真实接入需接短信网关（阿里云/腾讯云），并把手机号写入账户。
 */
export async function loginWithPhone(phone: string, code: string): Promise<Session> {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error("请输入有效的手机号");
  if (!/^\d{6}$/.test(code)) throw new Error("请输入 6 位验证码");
  const s: Session = {
    userId: `phone_${phone}`,
    name: `用户${phone.slice(-4)}`,
    avatar: phone.slice(-1),
    provider: "phone",
    isPro: false,
    tier: "free",
    createdAt: new Date().toISOString(),
    phone,
  };
  setDemoCookie();
  return persist(s);
}

/**
 * 第三方登录（演示）：QQ / 微信 真实授权需开放平台 AppID/Secret + 服务端回调，
 * 沙箱里没有凭证也无法验证真实跳转，这里只模拟「授权成功」并建一个本地演示会话。
 * 真实接入时把这里换成对应 OAuth 重定向即可，其余流程（绑手机→认识你自己）不变。
 */
export async function loginWithProvider(provider: "qq" | "wechat"): Promise<Session> {
  const s: Session = {
    userId: `${provider}_demo_${Date.now()}`,
    name: provider === "qq" ? "QQ 用户" : "微信用户",
    avatar: provider === "qq" ? "Q" : "微",
    provider,
    isPro: false,
    tier: "free",
    createdAt: new Date().toISOString(),
  };
  setDemoCookie();
  return persist(s);
}

/** 登出：清前端镜像 + 通知后端销毁 Cookie 会话 */
export async function logout(): Promise<void> {
  clearDemoCookie();
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  clearMirror();
}

/** 绑定手机号：更新前端镜像，并尽力同步到后端（后端无 key 时静默跳过） */
export async function bindPhone(phone: string): Promise<Session | null> {
  const s = getSession();
  if (!s) return null;
  await postJSON("/api/auth/bind-phone", { phone }).catch(() => {});
  return persist({ ...s, phone: phone.trim() });
}

// 注：曾有个 upgradeSession()「只改本地镜像的会员等级」，已删除。
// 原因：useSession 挂载时会回读 /api/auth/me，本地改的 tier 会被服务端值覆盖，
// 造成「支付页说解锁了、导航栏还是免费」。会员等级只能由服务端改（见 /api/billing/demo-upgrade）。

/** 拉取服务端真实会话并刷新前端镜像（页面挂载时调用，保证与服务端一致） */
export async function refreshSession(): Promise<Session | null> {
  // 演示会话（手机/QQ/微信）没有服务端 Cookie，/api/auth/me 必然 401，
  // 若回源会误把用户登出，所以直接用本地镜像。
  const local = getSession();
  if (local && local.provider !== "email") return local;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) {
      // Cookie 已失效 / 从未登录 —— 清掉可能残留的本地镜像，避免「假装已登录」
      clearMirror();
      return null;
    }
    const data = await res.json();
    return persist(mapUser(data.user));
  } catch {
    // 网络故障：保留现有镜像，不把用户误登出
    return getSession();
  }
}

/** 订阅登录态变化（含跨标签页同步） */
function subscribeSession(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY || e.key === null) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * 全站统一的登录态 Hook。
 *
 * 为什么不能只读 localStorage：真正的会话是服务端 HttpOnly Cookie，
 * 本地镜像只是给 UI 用的。两者会在「换设备 / 清缓存 / Cookie 过期」时不一致，
 * 所以挂载时必须回源 /api/auth/me 校准一次。
 *
 * loading 为 true 时表示还没校准完，UI 应显示骨架而不是「未登录」，
 * 否则已登录用户每次刷新都会看到一瞬间的登录按钮。
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSession,
    () => null // 服务端渲染时一律当作未登录
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    refreshSession().finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { session, loading };
}
