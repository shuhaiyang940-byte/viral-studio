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

export type Tier = "free" | "pro" | "premium";

export interface Session {
  userId: string;
  name: string;
  avatar: string;
  provider: "email";
  isPro: boolean;
  tier: Tier;
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

function mapUser(u: { id: string; email: string; name: string; tier: string }): Session {
  const name = u.name?.trim() || u.email.split("@")[0];
  return {
    userId: u.id,
    email: u.email,
    name,
    avatar: name.slice(0, 1).toUpperCase(),
    provider: "email",
    isPro: u.tier !== "free",
    tier: (u.tier as Tier) || "free",
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

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "请求失败");
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

/** 登出：清前端镜像 + 通知后端销毁 Cookie 会话 */
export async function logout(): Promise<void> {
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
