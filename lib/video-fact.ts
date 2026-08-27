// 视频理解真实性：分段计划、覆盖度指标、时间轴事实层（Phase 16.10）。
// 纯逻辑，可单测。诚实原则：覆盖不达阈值就标 PARTIAL，绝不假装 FULL。

export interface TimelineSegment {
  index: number;
  start: number; // 秒
  end: number; // 秒
  transcript?: string;
  visual?: string;
  ocr?: string;
}

export type CoverageStatus = "FULL" | "PARTIAL" | "LOW" | "NONE";

export interface VideoUnderstanding {
  durationSec: number | null;
  transcriptDurationSec: number | null;
  transcriptCoverage: number | null; // 0-1
  visualCoverageSec: number | null;
  visualCoverage: number | null; // 0-1
  segmentCount: number;
  segments: TimelineSegment[];
  coverageStatus: CoverageStatus;
  /* 关键证据：是否真实拿到转写 / 画面 / OCR */
  hasTranscript: boolean;
  hasVision: boolean;
  hasOcr: boolean;
  note: string;
}

/** 非固定分段：短视频少段、长视频自适应，绝不机械固定 20s。 */
export function planSegments(durationSec: number | null | undefined, opts: { maxSegments?: number } = {}): TimelineSegment[] {
  if (!durationSec || durationSec <= 0) return [];
  const maxSegments = Math.max(1, Math.min(opts.maxSegments ?? 8, 12));
  const n = durationSec <= 40 ? 2 : durationSec <= 90 ? 3 : durationSec <= 180 ? 5 : durationSec <= 300 ? 6 : Math.min(maxSegments, Math.max(7, Math.ceil(durationSec / 45)));
  const step = durationSec / n;
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    start: Math.round(i * step),
    end: Math.min(durationSec, Math.round((i + 1) * step)),
  }));
}

function cov(dur: number | null | undefined, covered: number | null | undefined): number | null {
  if (!dur || dur <= 0 || covered == null) return null;
  return Math.round(Math.min(1, covered / dur) * 1000) / 1000;
}

/** 覆盖状态：只有转写+画面都接近满才 FULL；否则 PARTIAL/LOW/NONE。 */
export function coverageStatus(transcriptCoverage: number | null, visualCoverage: number | null): CoverageStatus {
  const tc = transcriptCoverage ?? 0;
  const vc = visualCoverage ?? 0;
  if (tc >= 0.9 && vc >= 0.9) return "FULL";
  if (tc >= 0.5 || vc >= 0.5) return "PARTIAL";
  if (tc >= 0.1 || vc >= 0.1) return "LOW";
  return "NONE";
}

export function buildUnderstanding(params: {
  durationSec?: number | null;
  transcriptDurationSec?: number | null;
  visualCoverageSec?: number | null;
  hasTranscript?: boolean;
  hasVision?: boolean;
  hasOcr?: boolean;
  segments?: TimelineSegment[];
}): VideoUnderstanding {
  const durationSec = params.durationSec ?? null;
  const transcriptDurationSec = params.transcriptDurationSec ?? null;
  const tc = cov(durationSec, transcriptDurationSec);
  const visualCoverageSec = params.visualCoverageSec ?? null;
  const vc = cov(durationSec, visualCoverageSec);
  const hasTranscript = !!params.hasTranscript && transcriptDurationSec != null;
  const hasVision = !!params.hasVision && visualCoverageSec != null;
  const anythingRead = !!params.hasTranscript || !!params.hasVision;
  const status: CoverageStatus = durationSec == null
    ? (anythingRead ? "PARTIAL" : "NONE")
    : coverageStatus(tc, vc);
  const segments = params.segments?.length ? params.segments : planSegments(durationSec);
  const note = durationSec == null
    ? (anythingRead
        ? "已读取部分内容（画面/转写），但缺少视频时长，无法量化完整覆盖；不得声称完整理解。"
        : "未成功读取视频内容（画面/转写均未获取），分析仅基于标题与类型推断。")
    : status === "FULL"
    ? "语音转写+画面均达到高覆盖，可进行完整拆解。"
    : status === "PARTIAL"
      ? `仅部分内容被真实理解（转写覆盖 ${pct(tc)}，画面覆盖 ${pct(vc)}），拆解为部分。`
      : status === "LOW"
        ? "只解析到少量内容，无法保证完整拆解。"
        : "未成功读取视频内容（无有效转写/画面），分析仅基于标题与类型推断。";
  return {
    durationSec, transcriptDurationSec, transcriptCoverage: tc, visualCoverageSec,
    visualCoverage: vc, segmentCount: segments.length, segments, coverageStatus: status,
    hasTranscript, hasVision, hasOcr: !!params.hasOcr, note,
  };
}

function pct(x: number | null): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

/** 时间轴事实层：给 LLM 的时间戳化事实块（含覆盖诚实说明）。 */
export function timelineFactBlock(u: VideoUnderstanding): string {
  const segs = u.segments.filter((s) => s.transcript || s.visual || s.ocr);
  const lines: string[] = [];
  lines.push(`【视频事实层】总时长 ${u.durationSec ?? "未知"}s | 转写覆盖 ${pct(u.transcriptCoverage)} | 画面覆盖 ${pct(u.visualCoverage)} | 覆盖状态 ${u.coverageStatus}`);
  if (u.segments.length) lines.push(`- 分段计划 ${u.segments.length} 段：${u.segments.map((s) => `${s.start}-${s.end}s`).join("，")}`);
  if (segs.length) {
    for (const s of segs) {
      const bits: string[] = [`[${s.start}-${s.end}s]`];
      if (s.transcript) bits.push(`台词：${s.transcript}`);
      if (s.visual) bits.push(`画面：${s.visual}`);
      if (s.ocr) bits.push(`字幕/OCR：${s.ocr}`);
      lines.push(bits.join(" | "));
    }
  } else {
    lines.push("（本视频未能生成各时间段的转录/画面内容，切勿臆造具体时段的事实。）");
  }
  lines.push(u.note);
  return lines.join("\n");
}
