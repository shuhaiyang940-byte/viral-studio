import type { AnalysisReport, DirectorAdvice, OnboardingProfile } from "@/lib/types";
import { LEVEL_LABELS } from "@/lib/onboarding";

const DIM_LABELS: Record<string, string> = {
  hook: "开头吸引力",
  value: "内容价值",
  emotion: "情绪感染",
  interaction: "互动能力",
};

const DIM_TIPS: Record<string, string> = {
  hook: "前 3 秒再加一个反常识 / 身份共鸣钩子，把人先留住——完播率的根在这。",
  value: "每 15 秒塞一个具体细节（物件 / 数字 / 人名），信息密度还不够。",
  emotion: "结尾加一句情绪升华，给用户一个转发的理由。",
  interaction: "结尾抛个开放式问题，把评论区盘活，互动分能拉一截。",
};

const PAIN_TIPS: Record<string, string> = {
  不知道拍什么: "从你最熟的日常下手，普通人视角 + 具体细节最稳，别等灵感砸头上。",
  剪出来没人看: "先抄结构再抄内容：把爆款的前 3 秒和结尾互动扒出来，换成你的料。",
  不会找爆款: "案例库按你品类筛，看高赞视频的共同钩子，那就是能抄的爆点公式。",
  不会做特效: "特效别贪多，先把「转场 + 字幕花字 + 关键帧放大」玩顺，够出彩了。",
  节奏太拖: "镜头压到 2-3 秒，5 秒没新东西就剪，删废话比加内容管用。",
  不会写文案: "文案说人话：念给朋友听，哪拗口改哪。",
  不会配音: "先用剪映「文本朗读」顶上，自然度够用，别卡在声音上。",
  封面不行: "封面只放一句话 + 一个强表情 / 物件，别堆字；标题和封面一致。",
  设备不够: "手机 + 自然光就够起步，画质不够用「稳定 + 干净背景」补。",
  坚持不下来: "定个最小更新节奏（每周 1 条），先跑通再求量。",
};

/**
 * 我的 AI 导演：基于用户档案 + 历史分析记录，规则驱动生成长期优化建议。
 * 纯前端、无需后端；没有真实 AI 依赖，但输出真实来自用户数据（不是空话）。
 */
export function generateDirectorAdvice(
  profile: OnboardingProfile | null,
  history: AnalysisReport[]
): DirectorAdvice {
  if (!profile && history.length === 0) {
    return {
      ready: false,
      diagnosis: "还没有足够数据给我当军师。",
      priorities: [],
      weeklyTopics: [],
      missingHint: "先花 30 秒填写创作档案，再分析 1-2 个对标视频，我就能给你定制建议。",
    };
  }

  const ct = profile?.contentTypes[0];
  const platform = profile?.platforms.find((p) => p !== "还没发过");
  const levelLabel = profile ? LEVEL_LABELS[profile.level] : "有经验";

  // 定位诊断
  let diagnosis = "";
  if (profile) {
    diagnosis = `你是做「${ct ?? "综合内容"}」的${platform ?? "多平台"}创作者，目前${levelLabel}`;
    if (profile.style) diagnosis += `，主打「${profile.style}」风格`;
    if (profile.audience) diagnosis += `，面向${profile.audience}`;
    diagnosis += "。";
  } else {
    diagnosis = `你已分析过 ${history.length} 条视频，我先基于这些拆解给你方向。`;
  }

  // 历史短板维度（平均最低的两项）
  const dimSums: Record<string, number> = { hook: 0, value: 0, emotion: 0, interaction: 0 };
  for (const r of history) {
    dimSums.hook += r.score.hook;
    dimSums.value += r.score.value;
    dimSums.emotion += r.score.emotion;
    dimSums.interaction += r.score.interaction;
  }
  const n = history.length || 1;
  const dimAvg = {
    hook: Math.round(dimSums.hook / n),
    value: Math.round(dimSums.value / n),
    emotion: Math.round(dimSums.emotion / n),
    interaction: Math.round(dimSums.interaction / n),
  };
  const weakDims = (Object.keys(dimAvg) as (keyof typeof dimAvg)[])
    .sort((a, b) => dimAvg[a] - dimAvg[b])
    .slice(0, 2);

  // 优先建议：历史短板 + 档案痛点 + level 兜底
  const priorities: string[] = [];
  if (history.length >= 1) {
    for (const d of weakDims) {
      priorities.push(
        `你拆解的视频在「${DIM_LABELS[d]}」平均 ${dimAvg[d]} 分，是最大短板：${DIM_TIPS[d]}`
      );
    }
  }
  if (profile?.painPoints?.length) {
    for (const p of profile.painPoints.slice(0, 3)) {
      if (PAIN_TIPS[p]) priorities.push(PAIN_TIPS[p]);
    }
  }
  if (priorities.length === 0) {
    priorities.push("先拆解 3 个同品类高赞视频，对照它们的钩子与结构，找到你能抄的爆点公式。");
  }
  if (profile?.level === "novice") {
    priorities.push("别追求完美，先用手机拍出第一条完整视频发出去，比研究设备重要。");
  }

  // 本周选题
  const weeklyTopics = buildWeeklyTopics(profile, history);

  // 进步轨迹（历史 >= 2 才给）
  let progress: DirectorAdvice["progress"];
  if (history.length >= 2) {
    const sorted = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const first = sorted[0].score.overall;
    const last = sorted[sorted.length - 1].score.overall;
    const avg = Math.round(history.reduce((s, r) => s + r.score.overall, 0) / history.length);
    const trend: "up" | "down" | "flat" = last - first > 3 ? "up" : last - first < -3 ? "down" : "flat";
    const trendText = trend === "up" ? "稳步上升" : trend === "down" ? "有所回落" : "基本持平";
    progress = {
      analyzed: history.length,
      avgScore: avg,
      trend,
      note: `你已分析 ${history.length} 条视频，平均 ${avg} 分，较首条${trendText}。把上面的优先项逐个过一遍，下一条就能再上一个台阶。`,
    };
  }

  const missingHint = !profile
    ? "补充创作档案后，选题和方向建议会更对口你的赛道。"
    : history.length === 0
      ? "分析过 3 个对标后，这里会出现你的进步轨迹。"
      : undefined;

  return {
    ready: true,
    diagnosis,
    priorities: priorities.slice(0, 5),
    weeklyTopics,
    progress,
    missingHint,
  };
}

/** 本周选题：基于赛道钩子（来自历史或默认）生成 3 个方向 */
function buildWeeklyTopics(
  profile: OnboardingProfile | null,
  history: AnalysisReport[]
): { angle: string; why: string }[] {
  const ct = profile?.contentTypes[0] ?? "你的领域";
  const hooks = ["身份共鸣", "反常识", "痛点前置", "情绪钩子"];
  const picked = history.length
    ? [...new Set(history.map((h) => h.golden3s?.hookType).filter(Boolean) as string[])].slice(0, 3)
    : [];
  const pool = (picked.length ? picked : hooks).slice(0, 3);
  const whyBase = "和你的赛道对口，又踩在验证过的爆款钩子上，冷启动成功率更高。";
  return pool.map((h) => ({
    angle: `用「${h}」拍一条关于${ct}的内容`,
    why: `${h}是你已验证或最该练的钩子类型；${whyBase}`,
  }));
}
