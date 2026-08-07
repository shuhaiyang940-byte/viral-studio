import type { OnboardingProfile, VideoMeta } from "@/lib/types";

export interface MismatchInfo {
  userGoal: string;
  refType: string;
  message: string;
  reason?: string;
}

/**
 * 每个目标内容兼容的「参考视频桶」。
 * 参考视频类型会被归到这些桶里；若用户的目标里没有任何一个兼容该桶，就是明显不对路。
 */
const GOAL_COMPAT: Record<string, string[]> = {
  口播: ["生活情感", "知识", "种草", "测评", "剧情"],
  探店: ["种草", "测评", "生活情感"],
  好物种草: ["种草", "测评", "生活情感"],
  知识科普: ["知识", "测评"],
  Vlog: ["生活情感"],
  剧情: ["剧情"],
  电影解说: ["剧情"],
  颜值才艺: ["生活情感"],
};

/**
 * 每个「目标」真正要练的硬功夫（craft）。用来给用户讲清楚：你这条路靠什么吃饭。
 */
const GOAL_CRAFT: Record<string, string> = {
  口播: "人设表达 + 口播节奏 + 镜头稳住，核心是『人说话得有感染力』",
  探店: "实地跟拍 + 真实体验 + 探店脚本，核心是『把人带去现场』",
  好物种草: "产品展示 + 利益点 + 转化话术，核心是『把卖点一句话讲透』",
  知识科普: "信息密度 + 逻辑清晰 + 可视化，核心是『把一个知识点讲明白』",
  Vlog: "真实记录 + 生活质感 + 情绪流，核心是『过日子也能好看』",
  剧情: "脚本 + 表演 + 分镜，核心是『演好一个故事』",
  电影解说: "叙事重构 + 剪辑重组剧情 + 配音讲清楚，核心是『把长片剪成短故事』",
  颜值才艺: "人物颜值 / 才艺 + 氛围 + 运镜，核心是『人好看、活好玩』",
};

/**
 * 每个「参考桶」靠什么撑起来的（craft）。用来讲清楚：这条参考的功夫你抄不走。
 */
const BUCKET_CRAFT: Record<string, string> = {
  生活情感: "真实记录 + 情绪共鸣 + 生活流，基本不靠脚本和表演",
  知识: "信息密度 + 逻辑 + 可视化，靠的是内容本身过硬",
  种草: "产品利益点 + 转化话术，靠的是卖点表达",
  测评: "对比数据 + 客观评价，靠的是参数和立场",
  剧情: "脚本表演 + 分镜，靠的是演和拍",
};

function refBucket(type: string): string {
  if (type.includes("剧情")) return "剧情";
  if (type.includes("知识")) return "知识";
  if (type.includes("种草")) return "种草";
  if (type.includes("测评")) return "测评";
  // 生活记录 / 情感向 等统统归到「生活情感」
  return "生活情感";
}

/**
 * 检测用户想做的方向和传来的参考视频是否根本不是一回事。
 * 命中则返回明确警告（含 craft 差异解释）；没填目标、或参考至少对一个目标对口，则返回 undefined（不报警）。
 */
export function detectMismatch(
  profile: OnboardingProfile | undefined,
  meta: VideoMeta
): MismatchInfo | undefined {
  if (!profile || profile.contentTypes.length === 0) return undefined;

  const bucket = refBucket(meta.type || "");
  const onTarget = profile.contentTypes.some((g) =>
    (GOAL_COMPAT[g] || []).includes(bucket)
  );
  if (onTarget) return undefined;

  const goal = profile.contentTypes.join(" / ");
  const refType = meta.type || "未知类型";
  const primaryGoal = profile.contentTypes[0];

  const goalCraft = GOAL_CRAFT[primaryGoal];
  const refCraft = BUCKET_CRAFT[bucket];

  const message = `你想做「${goal}」，但这条参考是「${refType}」，完全不是一回事。照这么抄肯定做不起来——先换一条同赛道的参考再来，别硬上。`;

  let reason: string | undefined;
  if (goalCraft && refCraft) {
    reason = `说白了：你要做的「${primaryGoal}」，靠的是${goalCraft}；可这条参考是「${refType}」，靠的是${refCraft}。两套手法根本不通用，硬抄只会做出个四不像，既没参考的味儿，也没你想要的劲儿。`;
  }

  return { userGoal: goal, refType, message, reason };
}
