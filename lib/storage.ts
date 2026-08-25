import type { AnalysisReport, Storyboard, EditPlanRecord } from "@/lib/types";

const KEY = "viralstudio:reports";
const KEY_STORYBOARDS = "viralstudio:storyboards";
const KEY_PLANS = "viralstudio:editplans";
const KEY_PENDING = "viralstudio:pending-analysis";

/** 把一条创作资产同步到服务端工作区（绑 userId，由服务端 Session 决定）。未登录时 401 会被忽略。 */
async function syncToServer(type: "report" | "storyboard" | "plan", id: string, data: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, data }),
      keepalive: true,
    });
  } catch {
    // 服务端不可达 / 未登录：不阻塞本地，仅作为草稿缓存
  }
}

export function getReports(): AnalysisReport[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReport(report: AnalysisReport): void {
  if (typeof window === "undefined") return;
  const list = getReports();
  list.unshift(report);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  void syncToServer("report", report.id, report);
}

/* ════════ 导演分镜 ════════ */
export function getStoryboards(): Storyboard[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_STORYBOARDS) || "[]");
  } catch {
    return [];
  }
}

export function saveStoryboard(sb: Storyboard): void {
  if (typeof window === "undefined") return;
  const list = getStoryboards();
  const idx = list.findIndex((s) => s.id === sb.id);
  if (idx >= 0) list[idx] = sb;
  else list.unshift(sb);
  localStorage.setItem(KEY_STORYBOARDS, JSON.stringify(list.slice(0, 50)));
  void syncToServer("storyboard", sb.id, sb);
}

/* ════════ 智能剪辑方案记录 ════════ */
export function getEditPlans(): EditPlanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_PLANS) || "[]");
  } catch {
    return [];
  }
}

export function saveEditPlan(rec: EditPlanRecord): void {
  if (typeof window === "undefined") return;
  const list = getEditPlans();
  const idx = list.findIndex((p) => p.id === rec.id);
  if (idx >= 0) list[idx] = rec;
  else list.unshift(rec);
  localStorage.setItem(KEY_PLANS, JSON.stringify(list.slice(0, 50)));
  void syncToServer("plan", rec.id, rec);
}

/**
 * 从服务端拉取当前用户的创作资产，回灌到 localStorage（作为缓存）。
 * 用于跨设备 / 清除 localStorage 后，重登仍能看到服务端已持久化的数据。
 * 配合 SiteHeader 登录后调用一次即可（仅数据层同步，不影响 UI 布局）。
 */
export async function hydrateWorkspace(): Promise<void> {
  if (typeof window === "undefined") return;
  const types = ["report", "storyboard", "plan"] as const;
  for (const t of types) {
    try {
      const res = await fetch(`/api/workspace?type=${t}`);
      if (!res.ok) continue;
      const d = await res.json();
      const items = (d.items || []).map((i: any) => i.data).filter(Boolean);
      if (!items.length) continue;
      const key = t === "report" ? KEY : t === "storyboard" ? KEY_STORYBOARDS : KEY_PLANS;
      localStorage.setItem(key, JSON.stringify(items.slice(0, 50)));
    } catch {
      // 忽略（未登录 / 网络异常）
    }
  }
}

/* ════════ 分析 → 智能剪辑 握手 ════════ */
/** 记录「用户从某报告进入智能剪辑」，studio 载入时消费并生成骨架 */
export function setPendingAnalysis(reportId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_PENDING, reportId);
}
export function getPendingAnalysis(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_PENDING);
}
export function clearPendingAnalysis(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_PENDING);
}
