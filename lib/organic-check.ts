// 数据健康度 / 疑似刷量检测：诊断「账号内容是否真实、互动是否健康」。
// 规则驱动（不依赖 LLM），基于评论/点赞/转发/完播等比例做异常判断，诚实、可复核。
// 用户反馈点：评论/转发/点赞比例异常（如点赞极高的视频评论却极少）可能提示刷量或水军。

export interface OrganicSignal {
  /** 判断类型 */
  key: "comment_click_ratio" | "like_comment_ratio" | "share_like_ratio" | "plays_like_ratio";
  label: string;
  /** 是否异常 */
  redFlag: boolean;
  /** 结论 */
  detail: string;
  /** 强度：high=很可疑，medium=值得留意，low=正常 */
  level: "high" | "medium" | "low";
}

export interface OrganicCheckInput {
  plays?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  followers?: number;
}

export function checkOrganic(input: OrganicCheckInput): { score: number; signals: OrganicSignal[]; note: string } {
  const signals: OrganicSignal[] = [];
  const { plays, likes, comments, shares } = input;

  // 1) 点赞/播放 比例：正常约 1%~5% 附近；异常偏高（>8%）或过低（<0.3%）都值得留意
  if (plays && plays > 0 && likes != null) {
    const ratio = likes / plays;
    let level: OrganicSignal["level"] = "low";
    let redFlag = false;
    let detail = `点赞/播放 ${(ratio * 100).toFixed(1)}%，处于正常区间。`;
    if (ratio > 0.08) {
      level = "medium";
      redFlag = ratio > 0.12;
      detail = `点赞/播放 ${(ratio * 100).toFixed(1)}% 明显偏高，播放数据可能被压缩，或存在诱导点赞/互关，需留意。`;
    } else if (ratio < 0.003) {
      level = "medium";
      detail = `点赞/播放 ${(ratio * 100).toFixed(1)}% 偏低，内容钩子可能不够，或流量由非目标人群带入。`;
    }
    signals.push({ key: "plays_like_ratio", label: "点赞/播放比", redFlag, detail, level });
  }

  // 2) 评论/点赞 比例：正常约 1%~5%；若赞多而评论极少（<0.5%且赞>0），疑似水军/刷量
  if (likes && likes > 0 && comments != null) {
    const ratio = comments / likes;
    let level: OrganicSignal["level"] = "low";
    let redFlag = false;
    let detail = `评论/点赞 ${(ratio * 100).toFixed(1)}%，互动结构健康。`;
    if (ratio < 0.005 && likes > 500) {
      level = "high";
      redFlag = true;
      detail = `评论/点赞仅 ${(ratio * 100).toFixed(1)}%，点赞高但评论极少，疑为刷量点赞或互关粉，评论质量存疑。`;
    } else if (ratio > 0.15) {
      level = "medium";
      detail = `评论/点赞 ${(ratio * 100).toFixed(1)}% 偏高，话题讨论度强或评论区有争议引导。`;
    }
    signals.push({ key: "like_comment_ratio", label: "评论/点赞比", redFlag, detail, level });
  }

  // 3) 转发/点赞 比例：正常约 0%~5%；转发明显偏低可能是内容「看完即走」，无传播意愿
  if (likes && likes > 0 && shares != null && shares >= 0) {
    const ratio = shares / likes;
    let level: OrganicSignal["level"] = "low";
    let redFlag = false;
    let detail = `转发/点赞 ${(ratio * 100).toFixed(1)}%，传播意愿正常。`;
    if (ratio < 0.01 && likes > 100) {
      level = "medium";
      detail = `转发/点赞 ${(ratio * 100).toFixed(1)}% 偏低，内容「看完即走」，缺转发钩子（收藏/转发承诺）。`;
    } else if (ratio > 0.15) {
      level = "medium";
      redFlag = true;
      detail = `转发/点赞 ${(ratio * 100).toFixed(1)}% 异常偏高，疑似引导转发/抽奖/水军转发。`;
    }
    signals.push({ key: "share_like_ratio", label: "转发/点赞比", redFlag, detail, level });
  }

  // 汇总：有 high 或 >=2 个 medium → 判定内容真实性偏低
  const highCount = signals.filter((s) => s.level === "high").length;
  const medCount = signals.filter((s) => s.level === "medium").length;
  let score = 100;
  if (highCount > 0) score -= 25;
  if (medCount > 0) score -= 10;
  score = Math.max(0, score);

  const note =
    highCount > 0
      ? "检测到疑似刷量/水军信号，建议结合内容质量综合判断，勿只看互动数字。"
      : medCount > 0
        ? "互动存在一些比例失衡，建议逐条核查数据异常视频。"
        : "暂未发现明显刷量信号，互动结构健康。";

  return { score, signals, note };
}
