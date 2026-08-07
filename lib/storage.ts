import type { AnalysisReport, Storyboard, EditPlanRecord } from "@/lib/types";

const KEY = "viralstudio:reports";
const KEY_STORYBOARDS = "viralstudio:storyboards";
const KEY_PLANS = "viralstudio:editplans";
const KEY_PENDING = "viralstudio:pending-analysis";

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
