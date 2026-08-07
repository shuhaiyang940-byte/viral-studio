"use client";

/**
 * 免费用户配额（本地演示版）。
 *
 * 规则（来自用户需求）：免费用户每天可看 1 次「分析 + 具体做法建议」；会员（pro/premium）不限次。
 * 演示模式用 localStorage 按「userId + 当天日期」记录已用次数，跨天自动重置。
 *
 * 真实接入：把这里的读写换成后端接口（如 GET/POST /api/quota），用登录态识别用户，
 * 在数据库里按日期累计；防刷可加频率限制与风控。匿名用户不计入配额（先体验，看结果才要登录）。
 */

import { getSession, type Session } from "./auth";

const LS_KEY = "viralstudio:quota";

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

interface QuotaState {
  date: string;
  userId: string;
  count: number;
}

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
    /* ignore */
  }
}

function read(): QuotaState | null {
  const raw = safeGet(LS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuotaState;
  } catch {
    return null;
  }
}

function write(s: QuotaState) {
  safeSet(LS_KEY, JSON.stringify(s));
}

/** 当前配额信息；null session 视为未登录（可体验，不计入配额） */
export interface QuotaInfo {
  isPro: boolean;
  /** null 表示不限次 */
  limit: number | null;
  used: number;
  /** null 表示不限次 */
  remaining: number | null;
}

export function getQuota(session: Session | null): QuotaInfo {
  if (!session) return { isPro: false, limit: 1, used: 0, remaining: 1 };
  if (session.isPro) return { isPro: true, limit: null, used: 0, remaining: null };

  const key = todayKey();
  let s = read();
  if (!s || s.date !== key || s.userId !== session.userId) {
    s = { date: key, userId: session.userId, count: 0 };
    write(s);
  }
  const limit = 1;
  return {
    isPro: false,
    limit,
    used: s.count,
    remaining: Math.max(0, limit - s.count),
  };
}

/** 是否还能发起一次分析（匿名不限、会员不限、免费看当天剩余） */
export function canAnalyze(session: Session | null): boolean {
  if (!session) return true; // 匿名可体验一次
  if (session.isPro) return true;
  return (getQuota(session).remaining ?? 0) > 0;
}

/** 消耗一次免费配额（仅 free 生效，会员/匿名不消耗）。返回是否成功消耗 */
export function consumeQuota(session: Session | null): boolean {
  if (!session || session.isPro) return true;
  const key = todayKey();
  let s = read();
  if (!s || s.date !== key || s.userId !== session.userId) {
    s = { date: key, userId: session.userId, count: 0 };
  }
  if (s.count >= 1) return false;
  s.count += 1;
  write(s);
  return true;
}

/** 便捷：读取当前会话配额 */
export function getCurrentQuota(): QuotaInfo {
  return getQuota(getSession());
}
