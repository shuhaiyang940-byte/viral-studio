import type {
  AnalysisReport,
  Storyboard,
  StoryboardShot,
  ShotAngle,
  ShotLayout,
  BriefInput,
} from "@/lib/types";
import {
  PLAYBOOKS,
  findPlaybooks,
  type Playbook,
} from "@/lib/benchmarks";

/** 从「时间区间字符串」粗略解析出时长（秒），解析失败回退默认 */
function parseDuration(time: string, fallback: number): number {
  const nums = (time.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length >= 2) return Math.max(1, Math.round(nums[1] - nums[0]));
  if (nums.length === 1) return Math.max(1, nums[0]);
  return fallback;
}

/** 根据运镜文案推断示意图视角箭头 */
function inferAngle(camera: string): ShotAngle {
  if (/特写/.test(camera)) return "close";
  if (/空镜|广角|全景|远/.test(camera)) return "wide";
  if (/推|拉|摇|移|横移|运镜/.test(camera)) return "pan";
  if (/俯|高|顶/.test(camera)) return "high";
  if (/仰|低|贴地/.test(camera)) return "low";
  if (/跟拍|手持|第一人称|主观/.test(camera)) return "eye";
  return "eye";
}

/** 从段落文案里猜人物角色 */
function inferCharacters(text: string): string[] {
  const chars = ["主角（第一人称视角）"];
  if (/邻居|朋友|店员|老板|路人|群众|大家|他|她|老人|孩子|顾客/.test(text)) {
    chars.push("被记录对象");
  }
  if (/路人|群众| crowd |人群|大家/.test(text)) {
    return ["主角（第一人称视角）", "路人 / 群众", "环境人物"];
  }
  return chars;
}

/** 段落文案 → 场景短语（截短，去掉标点噪音） */
function toScene(label: string, detail: string): string {
  let base = detail || label;
  // 取第一句，截到 18 字
  base = base.split(/[。！？；;]/)[0].trim();
  if (base.length > 18) base = base.slice(0, 18) + "…";
  return base || label;
}

/**
 * 由分析报告派生一套导演分镜。
 * 数据全部来自现有报告字段（节奏段落 / 镜头清单 / 运镜建议 / 结构拆解），无需新的 AI 调用。
 */
export function buildStoryboard(report: AnalysisReport): Storyboard {
  const segments = report.pacing?.segments ?? [];
  const structure = report.section?.structure ?? [];
  const cameraTips = report.section?.shootingTips?.camera ?? [];
  const reproShots = report.repro?.shots ?? [];

  // 兜底：报告缺节奏段落时，用结构拆解的时间区间凑一套
  const src =
    segments.length > 0
      ? segments.map((s, i) => ({
          label: s.label,
          time: s.time,
          durationSec: s.durationSec || parseDuration(s.time, 6),
          detail: structure[i]?.detail ?? "",
        }))
      : structure.map((s, i) => ({
          label: s.label,
          time: s.time,
          durationSec: parseDuration(s.time, 6),
          detail: s.detail,
        }));

  const shots: StoryboardShot[] = src.map((seg, i) => {
    const detail = seg.detail;
    const characters = inferCharacters(detail + seg.label);
    const layout: ShotLayout =
      characters.length >= 3 ? "group" : characters.length === 2 ? "duo" : "single";
    // 运镜：优先用拍摄建议里对应段落的文案，否则按段落角色推断
    let camera = cameraTips[i] ?? "";
    if (!camera) {
      if (/钩子|开头|吸引/.test(seg.label)) camera = "固定机位特写，制造仪式感";
      else if (/高潮|结尾|收尾/.test(seg.label)) camera = "空镜慢镜头，留白给情绪";
      else camera = "第一人称手持跟拍，增强真实沉浸";
    }
    const angle = inferAngle(camera);
    const note = [
      detail,
      reproShots[i] ? `建议素材：${reproShots[i]}` : "",
      /钩子|开头/.test(seg.label) ? "前 3 秒必须抓住人，别让画面空着。" : "",
      /高潮|结尾/.test(seg.label) ? "情绪给足，留白别急着切。" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      index: i + 1,
      phase: seg.label,
      scene: toScene(seg.label, detail),
      characters,
      durationSec: seg.durationSec,
      camera,
      angle,
      layout,
      note: note || "按段落节奏拍摄，保持真实与沉浸。",
    };
  });

  const totalDurationSec = shots.reduce((s, x) => s + x.durationSec, 0);

  return {
    id: `sb-${report.id}`,
    reportId: report.id,
    title: report.meta.title,
    createdAt: new Date().toISOString(),
    shots,
    totalDurationSec,
  };
}

/* ════════ 由「需求入口」直接生成 AI 分镜 ════════ */

function ideaTypeLabel(t: BriefInput["ideaType"]): string {
  if (t === "sell") return "带货 / 种草";
  if (t === "talk") return "知识 / 口播";
  return "vlog / 剧情 / 测评";
}

/**
 * 由需求入口合成一份「够 studio 消费」的轻量分析报告（不调真模型）。
 * 只填 buildStoryboard 真正会用到的字段：结构段落、节奏段落、运镜建议、素材清单。
 */
function buildSyntheticReport(brief: BriefInput, playbook: Playbook): AnalysisReport {
  const now = new Date().toISOString();
  const id = `brief-${Date.now()}`;
  const segs = playbook.structure;
  let t = 0;
  const pacingSegs = segs.map((s) => {
    const start = t;
    t += s.secs;
    return { time: `${start}-${t}秒`, label: s.phase, durationSec: s.secs };
  });
  const total = t;
  return {
    id,
    meta: {
      title: brief.title.trim() || playbook.title,
      type: ideaTypeLabel(brief.ideaType),
      publishedAt: now.slice(0, 10),
      duration: `${total}秒`,
      platform: "抖音",
      views: 0,
    },
    score: { overall: 82, hook: 85, value: 80, emotion: 82, interaction: 78 },
    section: {
      whyHot: [playbook.hook, playbook.note],
      structure: segs.map((s, i) => ({
        time: pacingSegs[i].time,
        label: s.phase,
        detail: s.detail,
      })),
      replicableTemplate: {
        original: playbook.title,
        template: `${playbook.hook} —— 套用「${playbook.title}」结构，替换你的类目与素材即可复制。`,
      },
      titles: [brief.title.trim() || playbook.hook, playbook.hook, `${playbook.title}：手把手教你拍`],
      shootingTips: {
        camera: playbook.cameraTips,
        copy: [playbook.note],
        music: playbook.music,
      },
    },
    pacing: {
      hookSeconds: segs[0]?.secs ?? 3,
      avgShotSeconds: Math.max(1, Math.round(total / segs.length)),
      climaxAtSec: Math.round(total * 0.7),
      beatSync: true,
      segments: pacingSegs,
      suggestion: playbook.note,
    },
    repro: {
      path: "套模板",
      advice: playbook.note,
      shots: playbook.shots,
      sfx: ["转场 whoosh 音效", "重点强调音"],
      music: playbook.music,
    },
    createdAt: now,
  };
}

/**
 * 由「需求入口」直接生成 AI 分镜：先合成轻量报告，再复用 buildStoryboard 出分镜。
 * 合成报告会一并返回，调用方负责 saveReport + saveStoryboard，使 studio 能直接消费出骨架。
 */
export function briefToStoryboard(brief: BriefInput): {
  report: AnalysisReport;
  storyboard: Storyboard;
} {
  const playbook =
    findPlaybooks({ ideaType: brief.ideaType, category: brief.category, goal: brief.goal, limit: 1 })[0] ??
    PLAYBOOKS[0];
  const report = buildSyntheticReport(brief, playbook);
  const storyboard = buildStoryboard(report);
  storyboard.source = "brief";
  storyboard.title = brief.title.trim() || playbook.title;
  return { report, storyboard };
}
