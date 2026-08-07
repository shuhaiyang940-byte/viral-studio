// 浏览器端成片导出：canvas 逐帧合成预览 + MediaRecorder 录制。
// 纯前端、无需服务器 ffmpeg；文字/特效按页面一致的预设近似渲染。
// 说明：视频帧同步采用「进入片段即播放」策略，极端情况下可能有轻微丢帧，属 v1 已知边界。

import { GRADE_CSS, FILTER_TINT, EFFECT_STYLE } from "@/lib/studio-presets";

export interface RenderProgress {
  phase: "preparing" | "rendering" | "done";
  progress: number; // 0..1
}
interface RClip {
  id: string;
  kind?: "video" | "image";
  src?: string;
  startBeat: number;
  durationBeats: number;
  grade?: string;
  effect?: string;
  filter?: string;
  opacity?: number;
  scale?: number;
  rotate?: number;
  color?: string;
}
interface RText {
  content: string;
  startBeat: number;
  durationBeats: number;
  x?: number;
  y?: number;
  color?: string;
  fontSize?: number;
  stroke?: string;
  shadow?: boolean;
  bold?: boolean;
  align?: string;
  fontFamily?: string;
  animation?: string;
}
interface RAudio {
  src?: string;
  kind: "music" | "sfx";
  startBeat: number;
  durationBeats: number;
  volume?: number;
  muted?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}
export interface RPlan {
  meta: { orientation: "horizontal" | "vertical"; fps?: number; bpm?: number; durationBeats: number };
  clips: RClip[];
  huazi: RText[];
  subtitles: RText[];
  audio: RAudio[];
  trackOn?: Record<string, boolean>;
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  const cands = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c;
  return "video/webm";
}

function clipFilter(clip?: RClip | null): string {
  if (!clip) return "none";
  const f: string[] = [];
  if (clip.grade && GRADE_CSS[clip.grade] && GRADE_CSS[clip.grade] !== "none") f.push(GRADE_CSS[clip.grade]);
  if (clip.effect && EFFECT_STYLE[clip.effect]?.filter) f.push(EFFECT_STYLE[clip.effect].filter as string);
  return f.join(" ") || "none";
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  el: HTMLVideoElement | HTMLImageElement,
  W: number,
  H: number,
  scale: number,
  rotate: number,
) {
  const cw = (el as HTMLVideoElement).videoWidth || (el as HTMLImageElement).naturalWidth || W;
  const ch = (el as HTMLVideoElement).videoHeight || (el as HTMLImageElement).naturalHeight || H;
  if (!cw || !ch) return;
  const s = Math.max(W / cw, H / ch) * scale;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(el, -cw / 2, -ch / 2, cw, ch);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, item: RText, W: number, H: number, tSec: number, bpm: number) {
  const start = (item.startBeat * 60) / bpm;
  const dur = (item.durationBeats * 60) / bpm;
  const local = tSec - start;
  if (local < 0 || local > dur) return;
  const x = (item.x ?? 0.5) * W;
  const y = (item.y ?? 0.5) * H;
  const baseSize = item.fontSize ?? 48;
  let scale = 1;
  let dy = 0;
  let alpha = 1;
  let text = item.content || "";
  const a = item.animation || "none";
  const p = Math.min(1, local / 0.35);
  if (a === "popIn") scale = 0.6 + 0.4 * p;
  else if (a === "fadeUp") {
    dy = (1 - p) * 26;
    alpha = p;
  } else if (a === "typewriter") {
    const n = Math.max(1, Math.floor(text.length * Math.min(1, local / 0.5)));
    text = text.slice(0, n);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + dy);
  ctx.scale(scale, scale);
  ctx.font = `${item.bold ? 800 : 600} ${baseSize}px ${item.fontFamily || "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = item.color || "#fff";
  if (item.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 4;
  }
  if (item.stroke) {
    ctx.lineWidth = Math.max(2, baseSize / 16);
    ctx.strokeStyle = item.stroke;
    ctx.strokeText(text, 0, 0);
    ctx.shadowColor = "transparent";
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  plan: RPlan,
  tSec: number,
  bpm: number,
  activeClip: RClip | null,
  el: HTMLVideoElement | HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, W, H);
  // 背景媒体
  if (el) {
    ctx.save();
    ctx.filter = clipFilter(activeClip);
    ctx.globalAlpha = activeClip?.opacity ?? 1;
    drawCover(ctx, el, W, H, activeClip?.scale ?? 1, activeClip?.rotate ?? 0);
    ctx.restore();
  } else {
    ctx.fillStyle = activeClip?.color || "#111118";
    ctx.fillRect(0, 0, W, H);
  }
  // 滤镜色调叠加
  if (activeClip?.filter && FILTER_TINT[activeClip.filter]) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = FILTER_TINT[activeClip.filter];
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const sec = (beat: number) => (beat * 60) / bpm;
  const activeText = (arr: RText[]) =>
    arr.filter((t) => tSec >= sec(t.startBeat) && tSec < sec(t.startBeat) + sec(t.durationBeats));
  for (const t of activeText(plan.huazi)) drawText(ctx, t, W, H, tSec, bpm);
  for (const t of activeText(plan.subtitles)) drawText(ctx, t, W, H, tSec, bpm);
}

export async function renderToVideo(
  plan: RPlan,
  onProgress?: (p: RenderProgress) => void,
): Promise<{ url: string; mime: string; ext: string }> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined" || !canvasCaptureSupported()) {
    throw new Error("当前浏览器不支持客户端视频导出（需要 MediaRecorder / captureStream）");
  }
  const W = plan.meta.orientation === "vertical" ? 1080 : 1920;
  const H = plan.meta.orientation === "vertical" ? 1920 : 1080;
  const fps = plan.meta.fps || 30;
  const bpm = plan.meta.bpm || 120;
  const totalSec = (plan.meta.durationBeats * 60) / bpm;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  // 预载媒体元素
  const mediaEls = new Map<string, HTMLVideoElement | HTMLImageElement>();
  for (const c of plan.clips) {
    if (!c.src) continue;
    if (c.kind === "video") {
      const v = document.createElement("video");
      v.src = c.src;
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.preload = "auto";
      mediaEls.set(c.id, v);
    } else {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = c.src;
      mediaEls.set(c.id, im);
    }
  }
  await Promise.all(
    [...mediaEls.values()].map(
      (el) =>
        new Promise<void>((res) => {
          if (el instanceof HTMLVideoElement) {
            el.onloadeddata = () => res();
            el.onerror = () => res();
          } else {
            (el as HTMLImageElement).onload = () => res();
            (el as HTMLImageElement).onerror = () => res();
          }
          setTimeout(res, 2000);
        }),
    ),
  );

  // 音频混音
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioNodes: { el: HTMLAudioElement; item: RAudio; gain: GainNode }[] = [];
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  let audioCtx: AudioContext | null = null;
  if (AC && plan.audio.length) {
    const ctx = new AC() as AudioContext;
    audioCtx = ctx;
    audioDest = ctx.createMediaStreamDestination();
    for (const a of plan.audio) {
      if (!a.src) continue;
      const el = new Audio(a.src);
      el.crossOrigin = "anonymous";
      const srcNode = audioCtx.createMediaElementSource(el);
      const gain = audioCtx.createGain();
      srcNode.connect(gain);
      gain.connect(audioDest);
      audioNodes.push({ el, item: a, gain });
    }
  }

  const stream = canvas.captureStream(fps);
  if (audioDest) audioDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => {
    rec.onstop = () => res();
  });

  const sec = (beat: number) => (beat * 60) / bpm;
  const activeMedia = (t: number) =>
    plan.clips.filter(
      (c) => c.src && t >= sec(c.startBeat) && t < sec(c.startBeat) + sec(c.durationBeats),
    );

  onProgress?.({ phase: "preparing", progress: 0 });
  rec.start();
  let lastVid: string | null = null;
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const t = Math.min(elapsed, totalSec);

      // 视频播放管理
      const meds = activeMedia(t);
      const vClip = meds.find((c) => c.kind === "video");
      if (vClip) {
        const v = mediaEls.get(vClip.id) as HTMLVideoElement | undefined;
        if (v && lastVid !== vClip.id) {
          lastVid = vClip.id;
          try {
            v.currentTime = Math.max(0, t - sec(vClip.startBeat));
          } catch {}
          v.play().catch(() => {});
        }
      } else {
        lastVid = null;
      }

      // 音频播放管理
      for (const { el, item, gain } of audioNodes) {
        const inRange = t >= sec(item.startBeat) && t < sec(item.startBeat) + sec(item.durationBeats);
        if (inRange) {
          if (el.paused) {
            try {
              el.currentTime = Math.max(0, t - sec(item.startBeat));
            } catch {}
            el.play().catch(() => {});
          }
          const local = t - sec(item.startBeat);
          const dur = sec(item.durationBeats);
          let fade = 1;
          if (item.fadeIn && local < item.fadeIn) fade = local / item.fadeIn;
          else if (item.fadeOut && dur - local < item.fadeOut) fade = Math.max(0, (dur - local) / item.fadeOut);
          gain.gain.value = (item.muted ? 0 : item.volume ?? 1) * Math.max(0, Math.min(1, fade));
        } else if (!el.paused) {
          el.pause();
        }
      }

      // 取当前活动媒体绘制
      const clip = vClip || meds.find((c) => c.kind === "image") || null;
      const el = clip ? mediaEls.get(clip.id) || null : null;
      const ready =
        !!el &&
        (el instanceof HTMLVideoElement
          ? el.readyState >= 2
          : (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);
      drawFrame(ctx, W, H, plan, t, bpm, clip, ready ? el : null);

      onProgress?.({ phase: "rendering", progress: totalSec ? t / totalSec : 1 });
      if (elapsed >= totalSec) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  rec.stop();
  await stopped;
  audioNodes.forEach((a) => a.el.pause());
  for (const el of mediaEls.values()) if (el instanceof HTMLVideoElement) el.pause();

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  return { url, mime, ext: mime.includes("mp4") ? "mp4" : "webm" };
}

function canvasCaptureSupported(): boolean {
  const c = document.createElement("canvas");
  return typeof (c as any).captureStream === "function";
}
