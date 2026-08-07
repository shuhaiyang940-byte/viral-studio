"use client";

/**
 * AI 成长飞轮（本地占位版）。
 *
 * 设计目标（用户需求六）：
 * - 用户上传参考视频链接 → 我们提取「参考信号」（公开标签 / 高赞评论）；
 * - 这些信号 + 用户的目标分数 / 是否达标，会被**匿名**汇入一个成长池；
 * - 反过来，越多的「参考信号 → 用户结果」样本，系统就越懂「普通人怎么把不及格提到 70、及格提到 80」。
 *
 * 当前是 Mock / 本地演示版：数据只存在浏览器 localStorage，不上传、不绑定账号。
 *
 * ===== 将来真实接入的入口（占位说明，勿删） =====
 * 1. 匿名聚合：把 LearningEvent 批量上报到服务端做匿名聚合（去除任何可识别信息）。
 * 2. RAG 语料：把「参考信号 + 达标路径」沉淀为检索增强语料，问答时召回同类赛道经验。
 * 3. 微调数据集：把「signalTags + 目标分 + 是否被推荐路径命中」构造成 SFT / 偏好数据，
 *    用于微调感知层（Qwen3-VL）或推理层（DeepSeek V4）。
 * 4. 反馈闭环：用户后续是否真的复现成功（二次分析分数提升），作为正样本回灌。
 */

export interface LearningEvent {
  id: string;
  /** 关联的报告 id，用于去重（同一报告只贡献一次） */
  reportId: string;
  /** 参考视频类型 */
  refType: string;
  /** 当时提取到的参考信号标签 */
  signalTags: string[];
  /** 系统给该用户定的目标分（70 / 80 / 85） */
  targetScore: number;
  /** 这次分析的综合分是否达到 70『及格线』（匿名统计用） */
  reached: boolean;
  createdAt: string;
}

const LS_EVENTS = "vsa_learning_events";
const LS_CONTRIB = "vsa_learning_contributed";

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
    /* 隐私模式 / 配额满：静默失败，演示不影响主流程 */
  }
}

/** 记录一次匿名学习反馈（自动去重：同一 reportId 只记一次） */
export function recordLearningEvent(e: Omit<LearningEvent, "id" | "createdAt">): LearningEvent | null {
  if (typeof window === "undefined") return null;

  const contribRaw = safeGet(LS_CONTRIB);
  const contribSet: string[] = contribRaw ? JSON.parse(contribRaw) : [];
  if (contribSet.includes(e.reportId)) return null; // 已贡献过

  const ev: LearningEvent = {
    ...e,
    id: "le-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };

  const raw = safeGet(LS_EVENTS);
  const arr: LearningEvent[] = raw ? JSON.parse(raw) : [];
  arr.push(ev);
  safeSet(LS_EVENTS, JSON.stringify(arr.slice(-200))); // 最多保留最近 200 条

  contribSet.push(e.reportId);
  safeSet(LS_CONTRIB, JSON.stringify(contribSet));
  return ev;
}

export function hasContributed(reportId: string): boolean {
  const raw = safeGet(LS_CONTRIB);
  const set: string[] = raw ? JSON.parse(raw) : [];
  return set.includes(reportId);
}

export interface LearningStats {
  /** 已参与的匿名反馈次数 */
  count: number;
  /** 达标率（综合分 ≥ 70 的比例） */
  reachedRate: number;
  /** 高频参考标签（前 6） */
  topTags: string[];
}

export function getLearningStats(): LearningStats {
  const raw = safeGet(LS_EVENTS);
  const arr: LearningEvent[] = raw ? JSON.parse(raw) : [];
  const count = arr.length;
  const reached = arr.filter((e) => e.reached).length;
  const reachedRate = count ? Math.round((reached / count) * 100) : 0;

  const tagCount: Record<string, number> = {};
  arr.forEach((e) => e.signalTags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  return { count, reachedRate, topTags };
}

/**
 * 「AI 进化」等级（本地演示版）。
 *
 * 真实场景：全局基线来自服务端对所有用户匿名反馈的聚合（跨平台样本），
 * 本地贡献的样本（recordLearningEvent）会叠加进去，让模型越学越懂
 * 「普通人怎么把不及格提到 70、及格提到 80」，观点也越来越准、越来越敢说。
 *
 * 这里用 GLOBAL_BASELINE 模拟「已经学了上万次跨平台样本」的起点，
 * 再叠加你本地的匿名贡献，算出当前等级与「锐度」（观点是否够犀利、不温吞）。
 */
const GLOBAL_BASELINE_SAMPLES = 12480;
const GLOBAL_BASELINE_REACHED_RATE = 63;

export interface EvolutionInfo {
  /** 1-10 级 */
  level: number;
  /** 全局基线 + 本地贡献的总样本数 */
  totalSamples: number;
  /** 综合达标率（含全局基线） */
  reachedRate: number;
  /** 锐度：越高观点越敢说、越不温吞 */
  blunt: boolean;
  /** 锐度档位文案 */
  label: string;
}

export function getEvolution(): EvolutionInfo {
  const stats = getLearningStats();
  const total = GLOBAL_BASELINE_SAMPLES + stats.count;
  const reached = Math.round(
    (GLOBAL_BASELINE_SAMPLES * GLOBAL_BASELINE_REACHED_RATE + stats.count * stats.reachedRate) /
      Math.max(1, total)
  );
  // 每 1500 次样本升 1 级，封顶 10 级
  const level = Math.min(10, 1 + Math.floor(total / 1500));
  const blunt = level >= 5;
  const label =
    level >= 8
      ? "毒舌军师 · 观点极犀利"
      : level >= 5
        ? "老练军师 · 敢说真话"
        : level >= 3
          ? "进阶军师 · 渐有锋芒"
          : "新手军师 · 还在学";
  return { level, totalSamples: total, reachedRate: reached, blunt, label };
}
