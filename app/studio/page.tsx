"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisReport } from "@/lib/types";
import { getPendingAnalysis, clearPendingAnalysis, getReports, saveEditPlan } from "@/lib/storage";
import { FONT_LIBRARY } from "@/lib/fonts";
import { GRADE_CSS, FILTER_TINT, EFFECT_STYLE } from "@/lib/studio-presets";
import { renderToVideo } from "@/lib/studio-render";

/* ════════════════ 类型定义 ════════════════ */
interface PlanMeta {
  title: string; bpm: number; fps: number;
  durationBeats: number; orientation: "horizontal" | "vertical";
  referenceStyle: string;
}
interface Transition { type: string; durationBeats: number; }
interface ClipItem {
  id: string; label: string; startBeat: number; durationBeats: number;
  color?: string; kind?: "video" | "image";
  src?: string; assetId?: string; name?: string;
  volume?: number; speed?: number; opacity?: number; rotate?: number; scale?: number;
  fadeIn?: number; fadeOut?: number; muted?: boolean; locked?: boolean;
  effect?: string; grade?: string; filter?: string; transition?: Transition;
  /** 占位片段：由 AI 分析骨架生成，等待用户上传素材填充 */
  _ph?: boolean;
}
interface TextItem {
  id: string; content: string; startBeat: number; durationBeats: number;
  animation?: string; color?: string; fontSize?: number; stroke?: string;
  shadow?: boolean; bold?: boolean; align?: "left" | "center" | "right";
  fontFamily?: string; locked?: boolean; transition?: Transition;
  x?: number; y?: number; // 归一化位置 0..1，监视窗内可拖拽定位
}
interface AudioItem {
  id: string; kind: "music" | "sfx"; label: string; startBeat: number; durationBeats: number;
  src?: string; assetId?: string;
  volume?: number; fadeIn?: number; fadeOut?: number; speed?: number; muted?: boolean; locked?: boolean;
}
interface EditPlan {
  meta: PlanMeta; clips: ClipItem[]; huazi: TextItem[]; subtitles: TextItem[]; audio: AudioItem[];
  trackOn?: Record<string, boolean>;
}

type TrackKey = "clips" | "huazi" | "subtitles" | "audio";
type MaterialTab = "media" | "text" | "fonts" | "effects" | "transitions" | "color" | "filters";
type MediaCat = "all" | "video" | "image" | "audio";

/* ════════════════ 轨道（顺序：花字 → 字幕 → 视频 → 音频） ════════════════ */
const TRACK_DEF: Record<TrackKey, { label: string; color: string; icon: string }> = {
  huazi:     { label: "花字轨", color: "#f59e0b", icon: "✨" },
  subtitles: { label: "字幕轨", color: "#10b981", icon: "💬" },
  clips:     { label: "视频轨", color: "#3b82f6", icon: "🎬" },
  audio:     { label: "音频轨", color: "#8b5cf6", icon: "🎵" },
};
const TRACKS = Object.entries(TRACK_DEF) as [TrackKey, typeof TRACK_DEF[TrackKey]][];
const ALL_TRACKS: TrackKey[] = ["clips", "huazi", "subtitles", "audio"];

const ANIMATIONS = ["popIn", "fadeUp", "none", "typewriter"];
const LS_KEY = "viral-studio-edit-plan";
const SEG_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#0ea5e9"];

/** 从「时间区间字符串」粗略解析时长（秒），失败回退默认 */
function parseDur(time: string, fallback: number): number {
  const nums = (time.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length >= 2) return Math.max(1, Math.round(nums[1] - nums[0]));
  if (nums.length === 1) return Math.max(1, nums[0]);
  return fallback;
}

/**
 * 由分析报告生成「剪辑骨架」：节奏段落 → 占位片段（按段落顺序），标题 → 钩子花字。
 * 用户上传素材后按段落顺序自动填充（见 importFiles）。
 */
function buildSkeletonPlan(report: AnalysisReport): EditPlan {
  const bpm = 120;
  const beatsPerSec = bpm / 60;
  const round = (n: number) => Math.round(n * 2) / 2;
  const segments = report.pacing?.segments ?? [];
  const structure = report.section?.structure ?? [];
  const titles = report.section?.titles ?? [];

  const segs = segments.length
    ? segments.map((s, i) => ({ label: s.label, dur: s.durationSec || 6, detail: structure[i]?.detail ?? "" }))
    : structure.map((s) => ({ label: s.label, dur: parseDur(s.time, 6), detail: s.detail }));

  let cursor = 0;
  const clips: ClipItem[] = [];
  segs.forEach((seg, i) => {
    const startBeat = round(cursor * beatsPerSec);
    const durationBeats = Math.max(1, round(seg.dur * beatsPerSec));
    clips.push({
      id: uid("c"),
      label: `${seg.label}（待填充）`,
      startBeat,
      durationBeats,
      color: SEG_COLORS[i % SEG_COLORS.length],
      kind: "video",
      _ph: true,
    });
    cursor += seg.dur;
  });

  const huazi: TextItem[] = [];
  if (titles[0]) {
    huazi.push({
      id: uid("h"),
      content: titles[0],
      startBeat: 0,
      durationBeats: Math.max(2, round((segs[0]?.dur ?? 4) * beatsPerSec)),
    animation: "popIn",
    color: "#fde047",
    x: 0.5,
    y: 0.2,
  });
  }

  const totalBeats = Math.max(8, round(cursor * beatsPerSec));
  return {
    meta: {
      title: report.meta.title,
      bpm,
      fps: 30,
      durationBeats: totalBeats,
      orientation: "vertical",
      referenceStyle: report.meta.type || "AI 分析自动成片",
    },
    clips,
    huazi,
    subtitles: [],
    audio: [],
    trackOn: { clips: true, huazi: true, subtitles: true, audio: true },
  };
}

const TEXT_TEMPLATES = [
  { id: "tt1", content: "限时折扣" }, { id: "tt2", content: "点这里领券" },
  { id: "tt3", content: "手慢无！" },  { id: "tt4", content: "今天最后一天" },
  { id: "tt5", content: "全网最低价" },{ id: "tt6", content: "库存告急" },
];
const EFFECT_PRESETS = [
  { id: "e1", name: "闪光" }, { id: "e2", name: "故障风" }, { id: "e3", name: "模糊转清晰" },
  { id: "e4", name: "震动" }, { id: "e5", name: "缩放弹入" }, { id: "e6", name: "色差分离" },
  { id: "e7", name: "老电影" }, { id: "e8", name: "霓虹辉光" },
];
const TRANSITION_PRESETS = [
  { id: "t1", name: "硬切" }, { id: "t2", name: "交叉溶解" }, { id: "t3", name: "推拉" },
  { id: "t4", name: "擦除" }, { id: "t5", name: "旋转" },     { id: "t6", name: "闪白" },
];
const COLOR_PRESETS = [
  { id: "c1", name: "原片" }, { id: "c2", name: "明亮清新" }, { id: "c3", name: "电影感" },
  { id: "c4", name: "暖色调" }, { id: "c5", name: "冷色调" }, { id: "c6", name: "黑白" },
  { id: "c7", name: "复古胶片" },{ id: "c8", name: "赛博朋克" },
];
const FILTER_PRESETS = [
  { id: "f1", name: "日系小清新", bg: "#fef3e2" }, { id: "f2", name: "ins风", bg: "#fce4ec" },
  { id: "f3", name: "胶片感", bg: "#d7ccc8" },   { id: "f4", name: "赛博", bg: "#1a1a2e" },
  { id: "f5", name: "黑金", bg: "#212121" },       { id: "f6", name: "莫兰迪", bg: "#c8b4ae" },
];

/* 版权字体库来自 @/lib/fonts（编辑器内精简入口，完整库见 /fonts 页面） */

// 视觉预设（GRADE_CSS / FILTER_TINT / EFFECT_STYLE）已从 @/lib/studio-presets 引入，页面预览与成片导出共用。
const TRANSITION_CSS: Record<string, string> = {
  t1: "硬切", t2: "交叉溶解", t3: "推拉", t4: "擦除", t5: "旋转", t6: "闪白",
};

/* ════════════════ IndexedDB（导入素材 Blob 持久化） ════════════════ */
const DB_NAME = "viral-studio-assets";
function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") { rej(new Error("no idb")); return; }
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("assets"); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function putAsset(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function getAsset(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("assets", "readonly");
    const rq = tx.objectStore("assets").get(id);
    rq.onsuccess = () => res((rq.result as Blob) || null);
    rq.onerror = () => rej(rq.error);
  });
}

/* ════════════════ 工具 ════════════════ */
function active<T extends { startBeat: number; durationBeats: number }>(arr: T[], beat: number): T[] {
  return arr.filter(a => beat >= a.startBeat && beat < a.startBeat + a.durationBeats);
}
function fmt(beat: number, bpm: number): string {
  const s = (beat * 60) / bpm;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function uid(prefix: string): string { return prefix + Math.random().toString(36).slice(2, 9); }
function toSavable(plan: EditPlan): EditPlan {
  return {
    ...plan,
    clips: plan.clips.map(({ src, ...rest }) => rest),
    audio: plan.audio.map(({ src, ...rest }) => rest),
  } as EditPlan;
}
function ensureFont(url: string) {
  if (typeof document === "undefined") return;
  const id = "font-" + url.replace(/[^a-z0-9]/gi, "");
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id; l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${url}&display=swap`;
  document.head.appendChild(l);
}
/* 图片自适应压缩：按素材量/体积定压缩比，保流畅 */
async function compressImage(file: File, maxDim: number, quality: number): Promise<{ blob: Blob; src: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob")), "image/jpeg", quality));
    return { blob, src: URL.createObjectURL(blob) };
  } catch {
    return { blob: file, src: URL.createObjectURL(file) };
  }
}

/* ════════════════ 主组件 ════════════════ */
export default function StudioPage() {
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [trackOn, setTrackOn] = useState<Record<string, boolean>>({ clips: true, huazi: true, subtitles: true, audio: true });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [leftTab, setLeftTab] = useState<MaterialTab>("media");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [mediaCat, setMediaCat] = useState<MediaCat>("all");
  const [fontCat, setFontCat] = useState<string>("全部");
  const [showExport, setShowExport] = useState(false);
  const [snap, setSnap] = useState(true);
  const [monitorZoom, setMonitorZoom] = useState(1);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoExt, setVideoExt] = useState("webm");

  const planRef = useRef<EditPlan | null>(null); planRef.current = plan;
  const selRef = useRef(selectedIds); selRef.current = selectedIds;
  const trackOnRef = useRef(trackOn); trackOnRef.current = trackOn;
  const historyRef = useRef<EditPlan[]>([]);
  const futureRef = useRef<EditPlan[]>([]);
  const [histTick, setHistTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playheadRef = useRef(0); playheadRef.current = playhead;

  /* 加载 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let data: EditPlan | null = null;
        if (typeof window !== "undefined") {
          const local = localStorage.getItem(LS_KEY);
          if (local) { const p = JSON.parse(local); if (p?.meta) data = p; }
        }
        if (!data) { const r = await fetch("/api/plan"); data = await r.json(); }
        // 分析 → 智能剪辑：若用户从某报告点了「智能剪辑」，用分析结果生成剪辑骨架覆盖
        const pendingId = getPendingAnalysis();
        if (pendingId) {
          const rep = getReports().find(r => r.id === pendingId);
          if (rep) {
            data = buildSkeletonPlan(rep);
            clearPendingAnalysis();
            try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
            try {
              saveEditPlan({ id: `ep-${rep.id}`, reportId: rep.id, title: rep.meta.title, createdAt: new Date().toISOString(), segmentCount: (data as EditPlan).clips.length });
            } catch {}
          } else {
            clearPendingAnalysis();
          }
        }
        if (data && data.meta) {
          for (const c of data.clips ?? []) if (c.assetId && !c.src) { const b = await getAsset(c.assetId); if (b) c.src = URL.createObjectURL(b); }
          for (const a of data.audio ?? []) if (a.assetId && !a.src) { const b = await getAsset(a.assetId); if (b) a.src = URL.createObjectURL(b); }
          if (data.trackOn) setTrackOn(t => ({ ...t, ...data!.trackOn }));
        }
        if (!cancelled) { if (data?.meta) setPlan(data); else setError("无法读取编辑计划"); setLoaded(true); }
      } catch (e) { if (!cancelled) { setError(String(e)); setLoaded(true); } }
    })();
    return () => { cancelled = true; };
  }, []);

  /* 播放头 */
  useEffect(() => {
    if (!playing || !plan) return;
    const t = plan.meta.durationBeats;
    const id = setInterval(() => setPlayhead(p => { const n = p + 0.25; if (n >= t) { setPlaying(false); return t; } return n; }), 60);
    return () => clearInterval(id);
  }, [playing, plan]);

  /* 快捷键 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === " ") { e.preventDefault(); setPlaying(v => !v); }
      else if (e.key === "Delete" || e.key === "Backspace") del();
      else if (e.key === "ArrowLeft") nudge("startBeat", -0.5);
      else if (e.key === "ArrowRight") nudge("startBeat", 0.5);
      else if (e.key === "[") nudge("durationBeats", -0.5, 0.5);
      else if (e.key === "]") nudge("durationBeats", 0.5, 0.5);
      else if (e.key.toLowerCase() === "s") splitAtPlayhead();
      else if (e.key.toLowerCase() === "c") duplicate();
      else if (e.key.toLowerCase() === "m") toggleMuteSel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, plan]);

  /* 样式注入（纯 CSS，无 @apply） */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("se-styles")) return;
    const s = document.createElement("style");
    s.id = "se-styles";
    s.textContent = [
      ".se-no::-webkit-scrollbar{display:none}.se-no{-ms-overflow-style:none;scrollbar-width:none}",
      ".se-btn{padding:0.25rem 0.6rem;border-radius:0.375rem;font-size:0.75rem;font-weight:500;color:rgba(255,255,255,.6);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.05);transition:all .15s;white-space:nowrap}",
      ".se-btn:hover{color:#fff;background:rgba(255,255,255,.1)}",
      ".se-btn:disabled{opacity:.35;cursor:not-allowed}",
      ".se-btn-accent{padding:0.25rem 0.75rem;border-radius:0.375rem;font-size:0.75rem;font-weight:600;color:#fff;background:rgba(16,185,129,.8);border:1px solid rgba(34,197,94,.3)}",
      ".se-btn-accent:disabled{opacity:.4;cursor:not-allowed}",
      ".se-card{display:flex;align-items:center;gap:.5rem;padding:.5rem .625rem;border-radius:.375rem;cursor:pointer;border-left-width:2px;border-left-style:solid;background:rgba(255,255,255,.03);transition:all .12s}",
      ".se-card:hover{background:rgba(255,255,255,.07)}",
      ".se-card.sel{background:rgba(59,130,246,.18);border-left-color:#60a5fa !important}",
      ".se-input{width:100%;border-radius:.375rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.75rem;padding:.375rem .625rem;outline:none;box-sizing:border-box}",
      ".se-input:focus{border-color:rgba(255,255,255,.25)}",
      ".se-kbd{display:inline-flex;align-items:center;justify-content:center;padding:0 2px;border-radius:2px;font-size:.5625rem;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,.3);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}",
    ].join("");
    document.head.appendChild(s);
  }, []);

  /* ── 操作（统一 commit 支持撤销/重做） ── */
  const commit = useCallback((producer: (p: EditPlan) => EditPlan) => {
    const cur = planRef.current; if (!cur) return;
    historyRef.current.push(cur);
    if (historyRef.current.length > 60) historyRef.current.shift();
    futureRef.current = [];
    const np = producer(cur);
    np.trackOn = trackOnRef.current as any;
    setPlan(np);
    setHistTick(t => t + 1);
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current; if (!h.length || !planRef.current) return;
    const prev = h.pop()!; futureRef.current.push(planRef.current);
    setPlan(prev); setHistTick(t => t + 1);
  }, []);
  const redo = useCallback(() => {
    const f = futureRef.current; if (!f.length || !planRef.current) return;
    const nxt = f.pop()!; historyRef.current.push(planRef.current);
    setPlan(nxt); setHistTick(t => t + 1);
  }, []);

  const patchItem = useCallback((id: string, rec: Record<string, any>) => {
    commit(p => {
      const np = { ...p } as any;
      ALL_TRACKS.forEach(tk => { np[tk] = (np[tk] as any[]).map((it: any) => it.id === id ? { ...it, ...rec } : it); });
      return np;
    });
  }, [commit]);
  const primaryId = () => selRef.current[selRef.current.length - 1];
  const patch = useCallback((rec: Record<string, any>) => { const id = primaryId(); if (id) patchItem(id, rec); }, [patchItem]);

  const nudge = useCallback((field: "startBeat" | "durationBeats", d: number, m = 0) => {
    const id = primaryId(); if (!id) return;
    commit(p => {
      const np = { ...p } as any;
      ALL_TRACKS.forEach(tk => {
        np[tk] = (np[tk] as any[]).map((it: any) =>
          it.id === id ? { ...it, [field]: Math.max(m, (it[field] as number) + d) } : it
        );
      });
      return np;
    });
  }, [commit]);

  const del = useCallback(() => {
    const ids = selRef.current; if (!ids.length || !planRef.current) return;
    commit(p => {
      const np = { ...p } as any;
      ALL_TRACKS.forEach(tk => {
        np[tk] = (np[tk] as any[]).filter((x: any) => !ids.includes(x.id));
      });
      return np;
    });
    setSelectedIds([]);
  }, [commit]);

  const splitAtPlayhead = useCallback(() => {
    const id = primaryId(); const p = planRef.current; if (!id || !p) return;
    let found: any = null; ALL_TRACKS.forEach(tk => { const it = (p[tk] as any[]).find((x: any) => x.id === id); if (it) found = { it, tk }; });
    if (!found) return;
    const { it, tk } = found;
    const ph = playheadRef.current;
    if (ph <= it.startBeat || ph >= it.startBeat + it.durationBeats) { setHint("分割点需在片段内部"); return; }
    const id2 = uid(tk === "clips" ? "c" : tk === "huazi" ? "h" : tk === "subtitles" ? "s" : "a");
    const first = { ...it, durationBeats: ph - it.startBeat };
    const second = { ...it, id: id2, startBeat: ph, durationBeats: it.startBeat + it.durationBeats - ph };
    commit(pp => {
      const np = { ...pp } as any;
      np[tk] = (np[tk] as any[]).flatMap((x: any) => x.id === id ? [first, second] : [x]);
      return np;
    });
    setSelectedIds([id2]);
  }, [commit]);

  const duplicate = useCallback(() => {
    const id = primaryId(); const p = planRef.current; if (!id || !p) return;
    let found: any = null; ALL_TRACKS.forEach(tk => { const it = (p[tk] as any[]).find((x: any) => x.id === id); if (it) found = { it, tk }; });
    if (!found) return;
    const { it, tk } = found;
    const id2 = uid(tk === "clips" ? "c" : tk === "huazi" ? "h" : tk === "subtitles" ? "s" : "a");
    const copy = { ...it, id: id2, startBeat: it.startBeat + it.durationBeats };
    commit(pp => {
      const np = { ...pp } as any;
      np[tk] = [...(np[tk] as any[]), copy];
      return np;
    });
    setSelectedIds([id2]);
  }, [commit]);

  const toggleMuteSel = useCallback(() => {
    const ids = selRef.current; const p = planRef.current; if (!ids.length || !p) return;
    commit(np0 => {
      const np = { ...np0 } as any;
      ALL_TRACKS.forEach(tk => { np[tk] = (np[tk] as any[]).map((it: any) => ids.includes(it.id) ? { ...it, muted: !it.muted } : it); });
      return np;
    });
  }, [commit]);
  const toggleLockSel = useCallback(() => {
    const ids = selRef.current; const p = planRef.current; if (!ids.length || !p) return;
    commit(np0 => {
      const np = { ...np0 } as any;
      ALL_TRACKS.forEach(tk => { np[tk] = (np[tk] as any[]).map((it: any) => ids.includes(it.id) ? { ...it, locked: !it.locked } : it); });
      return np;
    });
  }, [commit]);

  const applyEffect = useCallback((type: string) => {
    const id = primaryId(); const p = planRef.current;
    if (!id) { setHint("请先选中一个片段"); return; }
    let isClip = false; ALL_TRACKS.forEach(tk => { if (tk !== "clips") return; if ((p![tk] as any[]).some((x: any) => x.id === id)) isClip = true; });
    if (!isClip) { setHint("特效请套用到视频/图片片段"); return; }
    patchItem(id, { effect: type }); setHint(`已应用特效：${EFFECT_PRESETS.find(e => e.id === type)?.name}`);
  }, [patchItem]);
  const applyTransition = useCallback((type: string) => {
    const id = primaryId(); if (!id) { setHint("请先选中一个片段"); return; }
    patchItem(id, { transition: { type, durationBeats: 2 } }); setHint(`已设置转场：${TRANSITION_CSS[type]}`);
  }, [patchItem]);
  const applyGrade = useCallback((type: string) => {
    const id = primaryId(); const p = planRef.current;
    if (!id) { setHint("请先选中一个片段"); return; }
    let isClip = false; ALL_TRACKS.forEach(tk => { if (tk !== "clips") return; if ((p![tk] as any[]).some((x: any) => x.id === id)) isClip = true; });
    if (!isClip) { setHint("调色请套用到视频/图片片段"); return; }
    patchItem(id, { grade: type }); setHint(`已套用调色：${COLOR_PRESETS.find(c => c.id === type)?.name}`);
  }, [patchItem]);
  const applyFilter = useCallback((type: string) => {
    const id = primaryId(); const p = planRef.current;
    if (!id) { setHint("请先选中一个片段"); return; }
    let isClip = false; ALL_TRACKS.forEach(tk => { if (tk !== "clips") return; if ((p![tk] as any[]).some((x: any) => x.id === id)) isClip = true; });
    if (!isClip) { setHint("滤镜请套用到视频/图片片段"); return; }
    patchItem(id, { filter: type }); setHint(`已套用滤镜：${FILTER_PRESETS.find(f => f.id === type)?.name}`);
  }, [patchItem]);
  const applyFont = useCallback((f: typeof FONT_LIBRARY[number]) => {
    const id = primaryId(); const p = planRef.current;
    if (!id) { setHint("请先选中一个花字/字幕，再套用字体"); return; }
    let isText = false; (["huazi", "subtitles"] as TrackKey[]).forEach(tk => { if ((p![tk] as any[]).some((x: any) => x.id === id)) isText = true; });
    if (!isText) { setHint("字体请套用到花字或字幕"); return; }
    ensureFont(f.url); patchItem(id, { fontFamily: f.family }); setHint(`已套用字体：${f.name}`);
  }, [patchItem]);

  const addText = useCallback((content: string) => {
    const p = planRef.current; if (!p) return;
    const id = uid("h");
    const sb = Math.round(playheadRef.current * 2) / 2;
    const item: TextItem = { id, content, startBeat: sb, durationBeats: 4, animation: "fadeUp", color: "#ffffff", fontSize: 28, align: "center", x: 0.5, y: 0.42 };
    commit(pp => {
      const np = { ...pp } as any;
      np.huazi = [...np.huazi, item];
      return np;
    });
    setSelectedIds([id]);
  }, [commit]);

  const importFiles = useCallback(async (files: FileList) => {
    const p = planRef.current; if (!p) return;
    const totalBytes = Array.from(files).reduce((s, f) => s + f.size, 0);
    const many = files.length > 8 || totalBytes > 25 * 1024 * 1024;
    const maxDim = many ? 720 : 1280;
    const quality = many ? 0.6 : 0.82;
    const importedClips: { id: string; kind: "video" | "image"; assetId: string; src: string; name: string }[] = [];
    const importedAudio: AudioItem[] = [];
    for (const f of Array.from(files)) {
      const isVideo = f.type.startsWith("video");
      const isImage = f.type.startsWith("image");
      const isAudio = f.type.startsWith("audio");
      if (!isVideo && !isImage && !isAudio) continue;
      const id = uid(isAudio ? "a" : "c");
      let src = "";
      let blob: Blob = f;
      try {
        if (isImage) { const r = await compressImage(f, maxDim, quality); blob = r.blob; src = r.src; }
        else { src = URL.createObjectURL(f); }
        await putAsset(id, blob);
      } catch { src = URL.createObjectURL(f); }
      if (isAudio) importedAudio.push({ id, kind: "music", label: f.name.replace(/\.[^.]+$/, ""), startBeat: 0, durationBeats: 8, assetId: id, src, volume: 1 });
      else importedClips.push({ id, kind: isImage ? "image" : "video", assetId: id, src, name: f.name });
    }
    const clipIds = importedClips.map(c => c.id);
    const audioIds = importedAudio.map(a => a.id);
    if (importedClips.length || importedAudio.length) {
      commit(pp => {
        const np = { ...pp } as any;
        // 视频/图片：优先按段落顺序自动填充占位片段，剩余追加到末尾
        if (importedClips.length) {
          let pi = 0;
          let lastEnd = 0;
          const filled: ClipItem[] = [];
          (np.clips as ClipItem[]).forEach((c: ClipItem) => {
            lastEnd = Math.max(lastEnd, c.startBeat + c.durationBeats);
            if (c._ph && pi < importedClips.length) {
              const spec = importedClips[pi++];
              filled.push({ ...c, ...spec, label: spec.name.replace(/\.[^.]+$/, ""), _ph: false });
            } else filled.push(c);
          });
          while (pi < importedClips.length) {
            const spec = importedClips[pi++];
            filled.push({ id: spec.id, label: spec.name.replace(/\.[^.]+$/, ""), startBeat: Math.round(lastEnd * 2) / 2, durationBeats: 8, kind: spec.kind, assetId: spec.assetId, src: spec.src, name: spec.name, volume: 1, opacity: 1, scale: 1, rotate: 0, speed: 1 });
            lastEnd += 8;
          }
          np.clips = filled;
        }
        if (importedAudio.length) np.audio = [...(np.audio as AudioItem[]), ...importedAudio];
        return np;
      });
      setSelectedIds([...clipIds, ...audioIds]);
      setHint(`已导入 ${clipIds.length + audioIds.length} 个素材${many ? "（已自动压缩以保流畅）" : ""}${clipIds.length ? "，已按分析段落自动铺到时间线" : ""}`);
    }
  }, [commit]);

  const onCommitDrag = useCallback((id: string, track: TrackKey, field: "startBeat" | "durationBeats", value: number) => {
    patchItem(id, { [field]: value });
  }, [patchItem]);
  /** 多选平移：所有选中片段按同一 beat 增量移动，保持相对位置 */
  const onCommitDragGroup = useCallback((ids: string[], field: "startBeat", delta: number) => {
    if (!delta) return;
    commit(p => {
      const np = { ...p } as any;
      ALL_TRACKS.forEach(tk => {
        np[tk] = (np[tk] as any[]).map((it: any) => ids.includes(it.id) ? { ...it, [field]: Math.max(0, (it[field] as number) + delta) } : it);
      });
      return np;
    });
  }, [commit]);
  const renameItem = useCallback((id: string, value: string) => { patchItem(id, { label: value, name: value }); }, [patchItem]);

  /** 素材 / 字体拖到时间线：media=在该 beat 处新增该素材实例；font=套用/新建花字 */
  const onDropAt = useCallback((beat: number, track: TrackKey, payload: { kind: "media" | "font"; id: string }) => {
    const p = planRef.current; if (!p) return;
    if (payload.kind === "font") {
      const f = FONT_LIBRARY.find(x => x.id === payload.id); if (!f) return;
      ensureFont(f.url);
      const isTextTrack = track === "huazi" || track === "subtitles";
      commit(np => {
        const n = { ...np } as any;
        if (isTextTrack) {
          const arr = n[track] as any[];
          const hit = arr.find((it: any) => beat >= it.startBeat && beat < it.startBeat + it.durationBeats);
          if (hit) n[track] = arr.map((it: any) => it.id === hit.id ? { ...it, fontFamily: f.family } : it);
          else {
            const id = uid(track === "huazi" ? "h" : "s");
            n[track] = [...arr, { id, content: "双击编辑", startBeat: Math.round(beat * 2) / 2, durationBeats: 4, animation: "fadeUp", color: "#ffffff", fontFamily: f.family, fontSize: 28, align: "center", x: 0.5, y: 0.42 }];
          }
        }
        return n;
      });
      setHint(`已套用字体：${f.name}`);
      return;
    }
    const cv = (p.clips as ClipItem[]).find(c => c.id === payload.id || c.assetId === payload.id);
    const av = (p.audio as AudioItem[]).find(a => a.id === payload.id || a.assetId === payload.id);
    let kind: "video" | "image" | "music" = "video"; let name = ""; let assetId = ""; let src = "";
    if (cv) { kind = (cv.kind || "video") as any; name = cv.label || cv.name || ""; assetId = cv.assetId || cv.id; src = cv.src || ""; }
    else if (av) { kind = "music"; name = av.label; assetId = av.assetId || av.id; src = av.src || ""; }
    else return;
    const sb = Math.round(beat * 2) / 2;
    commit(np => {
      const n = { ...np } as any;
      if (kind === "music") n.audio = [...(n.audio as any[]), { id: uid("a"), kind: "music", label: name, startBeat: sb, durationBeats: 8, assetId, src, volume: 1 }];
      else n.clips = [...(n.clips as any[]), { id: uid("c"), label: name, startBeat: sb, durationBeats: 8, kind, assetId, src, name, volume: 1, opacity: 1, scale: 1, rotate: 0, speed: 1, _ph: false }];
      return n;
    });
    setHint(`已将素材放到 ${fmt(sb, p.meta.bpm)}`);
  }, [commit]);
  const toggleTrack = useCallback((tk: TrackKey) => { setTrackOn(s => { const n = { ...s, [tk]: !s[tk] }; trackOnRef.current = n; return n; }); }, []);

  async function save() {
    if (!plan) return; setSaving(true); setError(null);
    const out = toSavable(plan); out.trackOn = trackOnRef.current;
    try { localStorage.setItem(LS_KEY, JSON.stringify(out)); await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(out) }); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }
  async function doRender() {
    if (!plan) return; setRendering(true); setError(null); setHint(null); setVideoUrl(null); setRenderProgress(0);
    try {
      // 用完整 plan（含素材 src）做客户端成片，不依赖服务器 ffmpeg
      const { url, ext } = await renderToVideo(plan as any, (p) => setRenderProgress(p.progress));
      setVideoUrl(url);
      setVideoExt(ext);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRendering(false);
    }
  }

  /* Loading / Error */
  if (!loaded) return <div style={{ background: "#0f0f13", color: "#9ca3af", height: "calc(100vh - 4rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>载入编辑计划中…</div>;
  if (!plan) return <div style={{ background: "#0f0f13", color: "#f87171", height: "calc(100vh - 4rem)", display: "flex", alignItems: "center", justifyContent: "center" }}>无法载入 · {error}</div>;

  const total = plan.meta.durationBeats;
  const selItems = selectedIds.map(id => {
    for (const tk of ALL_TRACKS) { const it = (plan[tk] as any[]).find((x: any) => x.id === id); if (it) return { tk, it }; }
    return null;
  }).filter(Boolean) as { tk: TrackKey; it: any }[];
  const primary = selItems[selItems.length - 1];
  const si = primary?.it ?? null;
  const siTrack = primary?.tk ?? null;
  const TW = Math.max(500, Math.floor(600 * zoom));
  const BP = TW / total;
  const phCount = (plan.clips as ClipItem[]).filter(c => c._ph).length;

  /* ═════ 渲染 ═════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 4rem)", overflow: "hidden", background: "#0f0f13" }}>
      {/* 顶栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 48, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#16161d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>智能剪辑</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{plan.meta.title}</span>
          <span style={{ fontSize: 10, background: "rgba(245,158,11,0.2)", color: "#fbbf24", padding: "1px 6px", borderRadius: 999 }}>Beta</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="se-btn" onClick={() => setPlaying(p => !p)}>{playing ? "⏸ 暂停" : "▶ 播放"}</button>
          <button className="se-btn" onClick={save} disabled={saving}>{saving ? "保存中…" : "💾 保存"}</button>
          <button className="se-btn-accent" onClick={() => setShowExport(true)} disabled={rendering}>{rendering ? "渲染中…" : "🎬 导出"}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[0.5, 0.75, 1, 1.5, 2].map(z => (
            <button key={z} onClick={() => setZoom(z)}
              style={{ width: 24, height: 24, borderRadius: 4, fontSize: 10, fontWeight: 500,
                background: Math.abs(zoom - z) < 0.01 ? "rgba(255,255,255,0.2)" : "transparent",
                color: Math.abs(zoom - z) < 0.01 ? "#fff" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer" }}>{z}x</button>
          ))}
        </div>
      </div>

      {phCount > 0 && (
        <div style={{ padding: "8px 16px", background: "rgba(59,130,246,0.12)", borderBottom: "1px solid rgba(96,165,250,0.3)", color: "#bfdbfe", fontSize: 12, lineHeight: 1.5 }}>
          🤖 这是 AI 分析生成的剪辑骨架：时间线已按「{phCount} 个段落」排好结构（钩子 / 铺垫 / 展开 / 高潮）。点击左侧「导入素材」上传你的视频或图片，系统会<b style={{ color: "#fff" }}>按段落顺序自动填充</b>，你只需做基础微调。
        </div>
      )}

      {/* 主区 */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {leftOpen ? (
          <MaterialPanel
            plan={plan} selectedIds={selectedIds} leftTab={leftTab} setLeftTab={setLeftTab}
            mediaCat={mediaCat} setMediaCat={setMediaCat} fontCat={fontCat} setFontCat={setFontCat}
            onSelectIds={setSelectedIds} onImportClick={() => fileInputRef.current?.click()}
            onAddText={addText} onApplyEffect={applyEffect} onApplyTransition={applyTransition}
            onApplyGrade={applyGrade} onApplyFilter={applyFilter} onApplyFont={applyFont}
            onClose={() => setLeftOpen(false)}
          />
        ) : (
          <button onClick={() => setLeftOpen(true)} style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", background: "transparent", border: "none", cursor: "pointer" }}>▶</button>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <PreviewMonitor plan={plan} playhead={playhead} trackOn={trackOn} monitorZoom={monitorZoom}
            onSeek={setPlayhead} playing={playing} onTogglePlay={() => setPlaying(v => !v)} onMonitorZoom={setMonitorZoom} onPatchItem={patchItem} />

          <TimelineToolbar
            selectedCount={selectedIds.length} snap={snap} setSnap={setSnap}
            canUndo={historyRef.current.length > 0} canRedo={futureRef.current.length > 0}
            onSplit={splitAtPlayhead} onDuplicate={duplicate} onDelete={del}
            onMute={toggleMuteSel} onLock={toggleLockSel} onUndo={undo} onRedo={redo}
            onZoomIn={() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2)))} onZoomOut={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} onFit={() => setZoom(1)}
          />

          <div style={{ position: "relative", borderTop: "1px solid rgba(255,255,255,0.1)", background: "#121218", minHeight: 240, maxHeight: 360, overflow: "hidden" }}>
            <TimelinePanel
              plan={plan} selectedIds={selectedIds} onSelectIds={setSelectedIds}
              trackOn={trackOn} onToggleTrack={toggleTrack}
              zoom={zoom} snap={snap} BP={BP} total={total}
              onCommitDrag={onCommitDrag} onCommitDragGroup={onCommitDragGroup}
              onRename={renameItem} onSeek={setPlayhead} onDropAt={onDropAt}
            />
            <PlayheadOverlay playhead={playhead} BP={BP} />
          </div>
        </div>

        {rightOpen ? (
          <PropertyPanel plan={plan} selectedIds={selectedIds} selItems={selItems} si={si} siTrack={siTrack}
            onPatch={patch} onPatchItem={patchItem} onDelete={del} onBulkMute={toggleMuteSel} onBulkLock={toggleLockSel} onClearSel={() => setSelectedIds([])} onClose={() => setRightOpen(false)} />
        ) : (
          <button onClick={() => setRightOpen(true)} style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", background: "transparent", border: "none", cursor: "pointer" }}>◀</button>
        )}
      </div>

      {/* 底栏 */}
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0c0c10", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{plan.clips.length} 视频 · {plan.audio.length} 音频 | {plan.meta.orientation === "vertical" ? "竖屏 9:16" : "横屏 16:9"} | {plan.meta.fps}fps · {plan.meta.bpm}BPM</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hint && <span style={{ color: "rgba(251,191,36,0.7)" }}>💡 {hint}</span>}
          {error && <span style={{ color: "rgba(248,113,113,0.7)" }}>⚠ {error}</span>}
          <span>Space播放 · Del删除 · S分割 · C复制 · M静音 · ←→微移 · []时长 · 点标尺定位 · Ctrl多选/框选</span>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*,image/*,audio/*" multiple style={{ display: "none" }}
        onChange={e => { if (e.target.files) importFiles(e.target.files); e.target.value = ""; }} />

      {showExport && (
        <div onClick={() => { if (!rendering) setShowExport(false); }} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>🎬 导出成片</div>
            {rendering ? (
              <div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 12 }}>正在合成视频，请保持页面在前台不要切换标签页…</p>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(renderProgress * 100)}%`, background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", transition: "width .1s" }} />
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, textAlign: "right" }}>{Math.round(renderProgress * 100)}%</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 16 }}>把当前时间线的视频 / 图片 / 字幕 / 花字 / 音乐实时合成为可下载的视频文件（浏览器支持 MP4 时导出 MP4，否则 WebM）。</p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowExport(false)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer" }}>取消</button>
                  <button onClick={doRender} disabled={rendering} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", background: rendering ? "rgba(34,197,94,0.5)" : "#22c55e", border: "none", cursor: "pointer" }}>{rendering ? "渲染中…" : "开始渲染"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {videoUrl && (
        <div onClick={() => setVideoUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>✅ 渲染完成！</div>
            <video src={videoUrl} controls autoPlay style={{ width: "100%", borderRadius: 8, background: "#000", maxHeight: 340 }} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <a href={videoUrl} download={`成片.${videoExt}`} style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", background: "#3b82f6", textDecoration: "none" }}>⬇ 下载成片</a>
              <button onClick={() => setVideoUrl(null)} style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer" }}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════ 素材库 ════════════════ */
interface MPProps {
  plan: EditPlan; selectedIds: string[]; leftTab: MaterialTab; setLeftTab: (t: MaterialTab) => void;
  mediaCat: MediaCat; setMediaCat: (c: MediaCat) => void; fontCat: string; setFontCat: (c: string) => void;
  onSelectIds: (ids: string[]) => void; onImportClick: () => void;
  onAddText: (c: string) => void; onApplyEffect: (t: string) => void; onApplyTransition: (t: string) => void;
  onApplyGrade: (t: string) => void; onApplyFilter: (t: string) => void; onApplyFont: (f: typeof FONT_LIBRARY[number]) => void; onClose: () => void;
}
const MaterialPanel = React.memo(function MaterialPanel(p: MPProps) {
  const isSel = (id: string) => p.selectedIds.includes(id);
  const dragStart = (payload: { kind: "media" | "font"; id: string }) => (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-viral", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };
  const tabBtn = (k: string, l: string) => (
    <button key={k} onClick={() => p.setLeftTab(k as MaterialTab)}
      style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", border: "none", cursor: "pointer",
        background: p.leftTab === k ? "rgba(255,255,255,0.15)" : "transparent", color: p.leftTab === k ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</button>
  );
  return (
    <div style={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.1)", background: "#14141a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {tabBtn("media", "📁素材")}{tabBtn("text", "✏️文字")}{tabBtn("fonts", "🔤字体")}{tabBtn("effects", "✨特效")}{tabBtn("transitions", "🔄转场")}{tabBtn("color", "🎨调色")}{tabBtn("filters", "🖼️滤镜")}
        </div>
        <button onClick={p.onClose} style={{ width: 20, height: 20, borderRadius: 4, fontSize: 10, color: "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", background: "transparent" }}>◀</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8, gap: 4, display: "flex", flexDirection: "column" }} className="se-no">
        {p.leftTab === "media" && <>
          <button onClick={p.onImportClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: "rgba(59,130,246,0.25)", border: "1px dashed rgba(96,165,250,0.5)", cursor: "pointer", marginBottom: 6 }}>⬆ 导入素材</button>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {([["all", "全部"], ["video", "视频"], ["image", "图片"], ["audio", "音频"]] as [MediaCat, string][]).map(([c, l]) => (
              <button key={c} onClick={() => p.setMediaCat(c)} style={{ flex: 1, padding: "3px 0", borderRadius: 4, fontSize: 10, border: "none", cursor: "pointer", background: p.mediaCat === c ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)", color: p.mediaCat === c ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</button>
            ))}
          </div>
          {p.mediaCat !== "audio" && <>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>视频 / 图片</div>
            {p.plan.clips.filter(c => p.mediaCat === "all" || (c.kind || "video") === p.mediaCat).map(c => (
              <div key={c.id} className={"se-card" + (isSel(c.id) ? " sel" : "")} style={{ borderLeftColor: c.color || "#3b82f6" }} onClick={() => p.onSelectIds([c.id])}
                draggable onDragStart={dragStart({ kind: "media", id: c.id })} title="拖到时间线可放到指定位置">
                <span>{(c.kind || "video") === "image" ? "🖼️" : "🎬"}</span>
                <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label || c.name}</span>
              </div>
            ))}
          </>}
          {p.mediaCat !== "video" && p.mediaCat !== "image" && <>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 4 }}>音频素材</div>
            {p.plan.audio.map(a => (
              <div key={a.id} className={"se-card" + (isSel(a.id) ? " sel" : "")} style={{ borderLeftColor: a.kind === "music" ? "#22c55e" : "#a855f7" }} onClick={() => p.onSelectIds([a.id])}
                draggable onDragStart={dragStart({ kind: "media", id: a.id })} title="拖到时间线可放到指定位置">
                <span>{a.kind === "music" ? "🎵" : "⚡"}</span>
                <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
              </div>
            ))}
          </>}
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.12)", fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, textAlign: "center" }}>🗂 共享素材（即将开放）<br />未来接入大量免版权视频素材</div>
        </>}
        {p.leftTab === "text" && <>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>点击在播放头处添加花字</div>
          {TEXT_TEMPLATES.map(t => <div key={t.id} className="se-card" style={{ borderLeftColor: "#f59e0b" }} onClick={() => p.onAddText(t.content)}><span>Aa</span><span style={{ fontSize: 11, fontWeight: 600, color: "rgba(251,191,36,0.8)" }}>{t.content}</span></div>)}
        </>}
        {p.leftTab === "fonts" && <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>可商用无版权字体 · 点选套用到花字/字幕</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
            {["全部", "标题", "正文", "手写", "数字", "西文"].map(c => (
              <button key={c} onClick={() => p.setFontCat(c)} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, border: "none", cursor: "pointer", background: p.fontCat === c ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)", color: p.fontCat === c ? "#fff" : "rgba(255,255,255,0.4)" }}>{c}</button>
            ))}
          </div>
          {FONT_LIBRARY.filter(f => p.fontCat === "全部" || f.cat === p.fontCat).map(f => (
            <div key={f.id} className="se-card" style={{ borderLeftColor: "#a855f7", flexDirection: "column", alignItems: "flex-start", gap: 2 }} onClick={() => p.onApplyFont(f)}
              draggable onDragStart={dragStart({ kind: "font", id: f.id })} title="拖到时间线的文字轨可套用字体">
              <span style={{ fontSize: 16, fontFamily: f.family, color: "#fff" }}>字体预览 Aa</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{f.name} · {f.cat}/{f.style}</span>
            </div>
          ))}
        </>}
        {p.leftTab === "effects" && <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>点选套用到选中视频/图片片段</div>
          {EFFECT_PRESETS.map(e => <div key={e.id} className="se-card" style={{ borderLeftColor: "#06b6d4" }} onClick={() => p.onApplyEffect(e.id)}><span>✨</span><span style={{ fontSize: 11 }}>{e.name}</span></div>)}
        </>}
        {p.leftTab === "transitions" && <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>点选设置选中片段的转场</div>
          {TRANSITION_PRESETS.map(t => <div key={t.id} className="se-card" style={{ borderLeftColor: "#ec4899" }} onClick={() => p.onApplyTransition(t.id)}><span>⟷</span><span style={{ fontSize: 11 }}>{t.name}</span></div>)}
        </>}
        {p.leftTab === "color" && <>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>点选套用调色（CSS 近似）</div>
          {COLOR_PRESETS.map(c => <div key={c.id} className="se-card" style={{ borderLeftColor: "#f97316" }} onClick={() => p.onApplyGrade(c.id)}><span>🎨</span><span style={{ fontSize: 11 }}>{c.name}</span></div>)}
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.12)", fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, textAlign: "center" }}>🎛 智能调色（即将开放）<br />未来自动匹配影片色调</div>
        </>}
        {p.leftTab === "filters" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {FILTER_PRESETS.map(f => <div key={f.id} style={{ cursor: "pointer", borderRadius: 6, overflow: "hidden" }} onClick={() => p.onApplyFilter(f.id)}>
              <div style={{ aspectRatio: "16/9", background: f.bg, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "2px 0" }}>{f.name}</div>
            </div>)}
          </div>
        )}
      </div>
      <div style={{ padding: "6px 8px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>🔜 AI 配音（即将开放）</div>
    </div>
  );
});

/* ════════════════ 预览监视器 ════════════════ */
const PreviewMonitor = React.memo(function PreviewMonitor({ plan, playhead, trackOn, monitorZoom, onSeek, playing, onTogglePlay, onMonitorZoom, onPatchItem }: {
  plan: EditPlan; playhead: number; trackOn: Record<string, boolean>; monitorZoom: number;
  onSeek: (n: number) => void; playing: boolean; onTogglePlay: () => void; onMonitorZoom: (f: (z: number) => number) => void;
  onPatchItem: (id: string, rec: Record<string, any>) => void;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; value: string } | null>(null);
  const on = (tk: TrackKey) => trackOn[tk] !== false;
  const startTextDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const frame = frameRef.current; if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const toXY = (cx: number, cy: number) => ({ x: Math.max(0, Math.min(1, (cx - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (cy - rect.top) / rect.height)) });
    const move = (ev: PointerEvent) => setDragPos({ id, ...toXY(ev.clientX, ev.clientY) });
    const up = (ev: PointerEvent) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); onPatchItem(id, toXY(ev.clientX, ev.clientY)); setDragPos(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const commitEdit = (id: string) => { if (editing) onPatchItem(id, { content: editing.value }); setEditing(null); };
  const ac = active(plan.clips, playhead).filter(() => on("clips"));
  const ah = active(plan.huazi, playhead).filter(() => on("huazi"));
  const as_ = active(plan.subtitles, playhead).filter(() => on("subtitles"));
  const aa = active(plan.audio, playhead).filter(() => on("audio"));
  const clip = ac[0];
  const vW = plan.meta.orientation === "vertical" ? 200 : 420;
  const vH = plan.meta.orientation === "vertical" ? 356 : 236;
  const mediaStyle: React.CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
    filter: [clip?.grade ? GRADE_CSS[clip.grade] : "", clip?.effect ? (EFFECT_STYLE[clip.effect]?.filter || "") : ""].filter(Boolean).join(" ") || undefined,
    transform: `scale(${clip?.scale ?? 1}) rotate(${clip?.rotate ?? 0}deg)` + (clip?.effect ? (EFFECT_STYLE[clip.effect]?.transform || "") : ""),
    boxShadow: clip?.effect ? (EFFECT_STYLE[clip.effect]?.boxShadow) : undefined,
    opacity: clip?.opacity ?? 1,
  };
  const tint = clip?.filter ? FILTER_TINT[clip.filter] : undefined;
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0a0a0e", minHeight: 200, position: "relative" }}>
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, alignItems: "center", zIndex: 30 }}>
        <button className="se-btn" onClick={() => onMonitorZoom(() => 1)} style={{ fontSize: 10, padding: "0 6px" }} title="适配：恢复原始尺寸">适配</button>
        <button className="se-btn" onClick={() => onMonitorZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))}>－</button>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", minWidth: 34, textAlign: "center" }}>{Math.round(monitorZoom * 100)}%</span>
        <button className="se-btn" onClick={() => onMonitorZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))}>＋</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div ref={frameRef} style={{ width: vW, height: vH, background: clip?.src ? "#000" : (clip?.color || "#111118"), borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", transform: `scale(${monitorZoom})`, transformOrigin: "center" }}>
          {clip?.src && clip.kind === "image" && <img src={clip.src} style={mediaStyle} alt="" />}
          {clip?.src && clip.kind !== "image" && <video src={clip.src} muted playsInline autoPlay loop style={mediaStyle} />}
          {tint && <div style={{ position: "absolute", inset: 0, background: tint, mixBlendMode: "overlay", pointerEvents: "none" }} />}
          <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 4, zIndex: 10 }}>
            {aa.map(a => <span key={a.id} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: a.kind === "music" ? "rgba(34,197,94,0.25)" : "rgba(139,92,246,0.25)", color: a.kind === "music" ? "#86efac" : "#c7d2fe" }}>{a.kind === "music" ? "♪" : "⚡"} {a.label}</span>)}
          </div>
          {/* 花字层：监视窗内可拖拽定位 + 双击改字 */}
          {ah.map((h) => {
            const pos = dragPos?.id === h.id ? dragPos : { x: h.x ?? 0.5, y: h.y ?? 0.5 };
            const isEdit = editing?.id === h.id;
            return (
              <div
                key={h.id}
                onPointerDown={(e) => startTextDrag(e, h.id)}
                onDoubleClick={(e) => { e.stopPropagation(); setEditing({ id: h.id, value: h.content }); }}
                title="拖拽移动位置 · 双击改字"
                style={{ position: "absolute", left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: "translate(-50%,-50%)", zIndex: 20, cursor: "move", maxWidth: "90%", userSelect: "none" }}
              >
                {isEdit ? (
                  <input
                    autoFocus
                    value={editing!.value}
                    onChange={(e) => setEditing({ id: h.id, value: e.target.value })}
                    onBlur={() => commitEdit(h.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(h.id); }}
                    style={{ fontFamily: h.fontFamily, color: h.color || "#fff", fontSize: plan.meta.orientation === "vertical" ? 26 : 22, fontWeight: h.bold ? 800 : 600, textAlign: "center", textShadow: h.shadow ? "0 2px 0 rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.5)", WebkitTextStroke: h.stroke ? `1px ${h.stroke}` : undefined, lineHeight: 1.2, background: "rgba(0,0,0,0.35)", border: "1px solid #60a5fa", borderRadius: 4, outline: "none", width: 220, padding: "2px 6px" }}
                  />
                ) : (
                  <span style={{ fontFamily: h.fontFamily, color: h.color || "#fff", fontSize: plan.meta.orientation === "vertical" ? 26 : 22, fontWeight: h.bold ? 800 : 600, textAlign: "center", textShadow: h.shadow ? "0 2px 0 rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.5)", WebkitTextStroke: h.stroke ? `1px ${h.stroke}` : undefined, lineHeight: 1.2, pointerEvents: "auto" }}>{h.content}</span>
                )}
              </div>
            );
          })}
          {/* 字幕层：同样可拖拽定位 + 双击改字 */}
          {as_.map((s) => {
            const pos = dragPos?.id === s.id ? dragPos : { x: s.x ?? 0.5, y: s.y ?? 0.85 };
            const isEdit = editing?.id === s.id;
            return (
              <div
                key={s.id}
                onPointerDown={(e) => startTextDrag(e, s.id)}
                onDoubleClick={(e) => { e.stopPropagation(); setEditing({ id: s.id, value: s.content }); }}
                title="拖拽移动位置 · 双击改字"
                style={{ position: "absolute", left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: "translate(-50%,-50%)", zIndex: 20, cursor: "move", userSelect: "none" }}
              >
                {isEdit ? (
                  <input
                    autoFocus
                    value={editing!.value}
                    onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                    onBlur={() => commitEdit(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(s.id); }}
                    style={{ fontFamily: s.fontFamily, color: "#fff", fontSize: plan.meta.orientation === "vertical" ? 14 : 13, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.8)", background: "rgba(0,0,0,0.35)", border: "1px solid #60a5fa", borderRadius: 4, outline: "none", width: 240, padding: "2px 8px" }}
                  />
                ) : (
                  <span style={{ fontFamily: s.fontFamily, color: "#fff", fontSize: plan.meta.orientation === "vertical" ? 14 : 13, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.8)", display: "inline-block", background: "rgba(0,0,0,0.35)", padding: "2px 8px", borderRadius: 4, pointerEvents: "auto" }}>{s.content}</span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: Math.min(420, vW + 40), marginTop: 4 }}>
          <button className="se-btn" onClick={() => onSeek(Math.max(0, playhead - 2))}>⏮</button>
          <button onClick={() => onTogglePlay()} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", fontSize: 14 }}>{playing ? "⏸" : "▶"}</button>
          <button className="se-btn" onClick={() => onSeek(Math.min(plan.meta.durationBeats, playhead + 2))}>⏭</button>
          <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative" }}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * plan.meta.durationBeats); }}>
            <div style={{ height: "100%", borderRadius: 9999, background: "linear-gradient(90deg,#3b82f6,#8b5cf6)", width: `${(playhead / plan.meta.durationBeats) * 100}%` }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", width: 80, textAlign: "right" }}>{fmt(playhead, plan.meta.bpm)} / {fmt(plan.meta.durationBeats, plan.meta.bpm)}</span>
        </div>
      </div>
    </div>
  );
}, (a, b) => {
  const sig = (p: EditPlan, ph: number, to: Record<string, boolean>) =>
    [active(p.clips, ph).filter(() => to.clips !== false), active(p.huazi, ph).filter(() => to.huazi !== false), active(p.subtitles, ph).filter(() => to.subtitles !== false), active(p.audio, ph).filter(() => to.audio !== false)]
      .map(arr => arr.map((x: any) => x.id).join(",")).join("|");
  return a.plan === b.plan && a.playing === b.playing && a.monitorZoom === b.monitorZoom && a.trackOn === b.trackOn && sig(a.plan, a.playhead, a.trackOn) === sig(b.plan, b.playhead, b.trackOn);
});

/* ════════════════ 时间线工具栏 ════════════════ */
interface TTProps {
  selectedCount: number; snap: boolean; setSnap: (b: boolean) => void;
  canUndo: boolean; canRedo: boolean;
  onSplit: () => void; onDuplicate: () => void; onDelete: () => void; onMute: () => void; onLock: () => void;
  onUndo: () => void; onRedo: () => void; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void;
}
const TimelineToolbar = React.memo(function TimelineToolbar(p: TTProps) {
  const has = p.selectedCount > 0;
  const style = (extra: React.CSSProperties = {}): React.CSSProperties => ({ padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", ...extra });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#15151c", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginRight: 2 }}>剪辑</span>
      <button style={style({ opacity: has ? 1 : 0.35 })} disabled={!has} onClick={p.onSplit}>✂ 分割 (S)</button>
      <button style={style({ opacity: has ? 1 : 0.35 })} disabled={!has} onClick={p.onDuplicate}>⧉ 复制 (C)</button>
      <button style={style({ opacity: has ? 1 : 0.35 })} disabled={!has} onClick={p.onDelete}>🗑 删除 (Del)</button>
      <button style={style({ opacity: has ? 1 : 0.35 })} disabled={!has} onClick={p.onMute}>🔇 静音 (M)</button>
      <button style={style({ opacity: has ? 1 : 0.35 })} disabled={!has} onClick={p.onLock}>🔒 锁定</button>
      <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />
      <button style={style({ color: p.snap ? "#60a5fa" : "rgba(255,255,255,0.7)", background: p.snap ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)" })} onClick={() => p.setSnap(!p.snap)}>🧲 吸附 {p.snap ? "开" : "关"}</button>
      <button style={style({ opacity: p.canUndo ? 1 : 0.35 })} disabled={!p.canUndo} onClick={p.onUndo}>↶ 撤销</button>
      <button style={style({ opacity: p.canRedo ? 1 : 0.35 })} disabled={!p.canRedo} onClick={p.onRedo}>↷ 重做</button>
      <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />
      <button style={style()} onClick={p.onZoomOut}>－</button>
      <button style={style()} onClick={p.onFit}>⤢ 适应</button>
      <button style={style()} onClick={p.onZoomIn}>＋</button>
      {has && <span style={{ fontSize: 10, color: "#60a5fa", marginLeft: 4 }}>已选 {p.selectedCount} 个</span>}
    </div>
  );
});

/* ════════════════ 时间线（多选 / 框选 / 改名 / 拖拽） ════════════════ */
interface TLProps {
  plan: EditPlan; selectedIds: string[]; onSelectIds: (ids: string[]) => void;
  trackOn: Record<string, boolean>; onToggleTrack: (tk: TrackKey) => void;
  zoom: number; snap: boolean; BP: number; total: number;
  onCommitDrag: (id: string, track: TrackKey, field: "startBeat" | "durationBeats", value: number) => void;
  onCommitDragGroup: (ids: string[], field: "startBeat", delta: number) => void;
  onSeek: (n: number) => void;
  onRename: (id: string, value: string) => void;
  onDropAt: (beat: number, track: TrackKey, payload: { kind: "media" | "font"; id: string }) => void;
}
const TimelinePanel = React.memo(function TimelinePanel(p: TLProps) {
  const [drag, setDrag] = useState<{ id: string; track: TrackKey; field: "startBeat" | "durationBeats"; startX: number; orig: number; value: number; delta: number; moveAll: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropBeat, setDropBeat] = useState<number | null>(null);

  const beginDrag = (e: React.PointerEvent, it: any, tk: TrackKey, field: "startBeat" | "durationBeats") => {
    if (it.locked) return;
    e.stopPropagation();
    const others = p.selectedIds;
    const moveAll = field === "startBeat" && others.length > 1 && others.includes(it.id);
    if (!moveAll) p.onSelectIds([it.id]);
    const startX = e.clientX; const orig = it[field] as number;
    setDrag({ id: it.id, track: tk, field, startX, orig, value: orig, delta: 0, moveAll });
    const move = (ev: PointerEvent) => {
      const dB = (ev.clientX - startX) / p.BP;
      if (field === "durationBeats") {
        let v = orig + dB; if (p.snap) v = Math.round(v * 2) / 2; v = Math.max(0.5, v);
        setDrag(d => (d ? { ...d, value: v } : d));
      } else {
        let delta = dB; if (p.snap) delta = Math.round(delta * 2) / 2;
        setDrag(d => (d ? { ...d, delta, value: orig + delta } : d));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(d => {
        if (!d) return null;
        if (d.field === "durationBeats") {
          if (d.value !== d.orig) p.onCommitDrag(d.id, d.track, d.field, d.value);
        } else {
          const delta = d.delta ?? 0;
          if (delta !== 0) {
            if (d.moveAll) p.onCommitDragGroup(others, d.field, delta);
            else p.onCommitDrag(d.id, d.track, d.field, d.value);
          }
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* FCP 式播放头：点标尺任意位置即跳转，按住拖拽即擦除式定位 */
  const beginSeek = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const seekTo = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      p.onSeek((x / rect.width) * p.total);
    };
    seekTo(e.clientX);
    const move = (ev: PointerEvent) => seekTo(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const beginMarquee = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x0 = e.clientX - rect.left, y0 = e.clientY - rect.top;
    setMarquee({ x0, y0, x1: x0, y1: y0 });
    const move = (ev: PointerEvent) => { setMarquee({ x0, y0, x1: ev.clientX - rect.left, y1: ev.clientY - rect.top }); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const x1 = ev.clientX - rect.left, y1 = ev.clientY - rect.top;
      const rx0 = Math.min(x0, x1), rx1 = Math.max(x0, x1), ry0 = Math.min(y0, y1), ry1 = Math.max(y0, y1);
      if (Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4) { p.onSelectIds([]); }
      else {
        const ids: string[] = [];
        TRACKS.forEach(([tk], ti) => {
          if (p.trackOn[tk] === false) return;
          (p.plan[tk] as any[]).forEach(it => {
            const cx0 = it.startBeat * p.BP, cx1 = (it.startBeat + it.durationBeats) * p.BP;
            const cy0 = ti * 46 + 3, cy1 = ti * 46 + 41;
            if (cx1 > rx0 && cx0 < rx1 && cy1 > ry0 && cy0 < ry1) ids.push(it.id);
          });
        });
        p.onSelectIds(ids);
      }
      setMarquee(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* 素材 / 字体拖拽放置：素材→在落点新增实例；字体→套用或新建花字 */
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-viral")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropBeat(Math.max(0, (e.clientX - rect.left) / p.BP));
  };
  const onDragLeave = () => setDropBeat(null);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-viral");
    setDropBeat(null);
    if (!raw) return;
    let payload: { kind: "media" | "font"; id: string };
    try { payload = JSON.parse(raw); } catch { return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
    const beat = Math.max(0, x / p.BP);
    let ti = Math.floor(y / 46); if (ti < 0) ti = 0; if (ti > TRACKS.length - 1) ti = TRACKS.length - 1;
    p.onDropAt(beat, TRACKS[ti][0], payload);
  };

  const onTrackToggle = (tk: TrackKey) => { p.onToggleTrack(tk); };

  return (
    <>
      {/* 刻度尺（点击/拖拽定位播放头，FCP 式） */}
      <div style={{ height: 24, borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative", marginLeft: 92 }}>
        <div style={{ position: "relative", height: "100%", width: p.BP * p.total, cursor: "pointer", touchAction: "none" }} onPointerDown={beginSeek}>
          {Array.from({ length: Math.ceil(p.total) + 1 }, (_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: i * p.BP, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 1, height: 8, background: "rgba(255,255,255,0.15)" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", lineHeight: 1, marginTop: 1 }}>{i}</span>
            </div>
          ))}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(239,68,68,0.25)", pointerEvents: "none" }} />
        </div>
      </div>
      {/* 轨道 */}
      <div style={{ marginLeft: 92, position: "relative", padding: "2px 0" }} onPointerDown={beginMarquee}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div style={{ position: "relative", width: p.BP * p.total, minHeight: TRACKS.length * 46 }}>
          {TRACKS.map(([tk, td], ti) => {
            const items = p.plan[tk] as any[];
            const off = p.trackOn[tk] === false;
            return (
              <div key={tk} style={{ position: "relative", height: 44, marginTop: ti > 0 ? 2 : 0, opacity: off ? 0.3 : 1 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: ti % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }} />
                {items.map((it: any) => {
                  const isDragging = !!drag;
                  const isPrimary = drag != null && drag.id === it.id;
                  const isDur = isPrimary && drag!.field === "durationBeats";
                  const pos = isPrimary ? (isDur ? it.startBeat : drag!.value) : (isDragging && drag!.moveAll && p.selectedIds.includes(it.id) ? it.startBeat + (drag!.delta ?? 0) : it.startBeat);
                  const dur = isDur ? drag!.value : it.durationBeats;
                  const l = pos * p.BP, w = Math.max(dur * p.BP, 12);
                  const sl = p.selectedIds.includes(it.id);
                  const badges = [it.transition ? "⟷" : "", it.effect ? "✨" : "", it.grade ? "🎨" : "", it.filter ? "▦" : ""].filter(Boolean).join(" ");
                  return (
                    <div key={it.id}
                      onPointerDown={e => beginDrag(e, it, tk, "startBeat")}
                      onDoubleClick={e => { e.stopPropagation(); setRenaming(it.id); }}
                      onClick={e => e.stopPropagation()}
                      title={`${it.content || it.label || it.name || ""}${badges ? " · " + badges : ""}（双击改名）`}
                      style={{ position: "absolute", left: l, width: w, top: 3, bottom: 3, borderRadius: 6, cursor: "grab", display: "flex", alignItems: "center", padding: "0 6px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#fff", fontSize: 11, fontWeight: 600,
                        background: sl ? td.color : td.color + "cc", boxShadow: sl ? "0 0 0 2px #60a5fa" : "none", zIndex: sl ? 10 : 1, opacity: it.locked ? 0.7 : 1 }}>
                      {renaming === it.id ? (
                        <input autoFocus defaultValue={it.label || it.content || it.name || ""} onPointerDown={e => e.stopPropagation()} onBlur={e => { p.onRename(it.id, e.target.value); setRenaming(null); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }} style={{ width: "100%", fontSize: 11, background: "rgba(0,0,0,0.4)", border: "1px solid #60a5fa", borderRadius: 3, color: "#fff", padding: "1px 3px", outline: "none" }} />
                      ) : (
                        <>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.content || it.label || it.name || ""}</span>
                          {badges && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.85 }}>{badges}</span>}
                          {it.locked && <span style={{ fontSize: 9, marginLeft: "auto" }}>🔒</span>}
                          {it.muted && <span style={{ fontSize: 9, marginLeft: 2 }}>🔇</span>}
                        </>
                      )}
                      <div onPointerDown={e => beginDrag(e, it, tk, "durationBeats")} title="拖拽调整时长"
                        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 10, cursor: "ew-resize", background: "rgba(255,255,255,0.18)", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: 2, height: 14, borderRadius: 2, background: "rgba(255,255,255,0.75)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {marquee && (
            <div style={{ position: "absolute", left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0), background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.6)", pointerEvents: "none", zIndex: 15 }} />
          )}
          {dropBeat != null && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: dropBeat * p.BP, width: 2, background: "#22c55e", pointerEvents: "none", zIndex: 18 }} />
          )}
        </div>
      </div>
      {/* 轨道标签 + 开关（左侧） */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 92, borderRight: "1px solid rgba(255,255,255,0.1)", background: "#121218" }}>
        {TRACKS.map(([tk, td], ti) => (
          <div key={tk} style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 6px", height: 44, marginTop: ti > 0 ? 2 : 0, borderBottom: "1px solid rgba(255,255,255,0.05)", background: ti % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <button onClick={() => onTrackToggle(tk)} title="开关整条轨道" style={{ width: 26, height: 16, borderRadius: 999, border: "none", cursor: "pointer", padding: 0, background: p.trackOn[tk] === false ? "rgba(255,255,255,0.15)" : "#22c55e", position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 1, width: 14, height: 14, borderRadius: 999, background: "#fff", left: p.trackOn[tk] === false ? 1 : 11, transition: "left .12s" }} />
            </button>
            <span style={{ fontSize: 12 }}>{td.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{td.label}</span>
          </div>
        ))}
      </div>
    </>
  );
});

/* ════════════════ 播放头覆盖层 ════════════════ */
const PlayheadOverlay = React.memo(function PlayheadOverlay({ playhead, BP }: { playhead: number; BP: number }) {
  const left = 92 + playhead * BP;
  return <div style={{ position: "absolute", top: 0, bottom: 0, left, width: 1, background: "#ef4444", zIndex: 20, pointerEvents: "none" }} />;
});

/* ════════════════ 属性面板 ════════════════ */
interface PPProps {
  plan: EditPlan; selectedIds: string[]; selItems: { tk: TrackKey; it: any }[]; si: any; siTrack: TrackKey | null;
  onPatch: (rec: Record<string, any>) => void; onPatchItem: (id: string, rec: Record<string, any>) => void;
  onDelete: () => void; onBulkMute: () => void; onBulkLock: () => void; onClearSel: () => void; onClose: () => void;
}
const PropertyPanel = React.memo(function PropertyPanel(p: PPProps) {
  const closeBtn = <button onClick={p.onClose} style={{ width: 20, height: 20, borderRadius: 4, fontSize: 10, color: "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", background: "transparent" }}>◀</button>;
  const header = <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}><span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>属性</span>{closeBtn}</div>;

  if (p.selectedIds.length === 0) return (
    <div style={{ width: 256, borderLeft: "1px solid rgba(255,255,255,0.1)", background: "#14141a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {header}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}><div style={{ fontSize: 24, marginBottom: 8 }}>👆</div>点片段选中 · 空白处拖拽框选<br />双击片段可改名</div>
      </div>
    </div>
  );

  if (p.selectedIds.length > 1) return (
    <div style={{ width: 256, borderLeft: "1px solid rgba(255,255,255,0.1)", background: "#14141a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {header}
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#60a5fa" }}>已选中 {p.selectedIds.length} 个片段</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>可批量删除 / 静音 / 锁定。要看单个片段的详细属性，先单击单独选中它。</div>
        <button onClick={p.onBulkMute} style={bulkBtn("#f59e0b")}>🔇 批量静音</button>
        <button onClick={p.onBulkLock} style={bulkBtn("#8b5cf6")}>🔒 批量锁定</button>
        <button onClick={p.onDelete} style={bulkBtn("#ef4444")}>🗑 批量删除</button>
        <button onClick={p.onClearSel} style={bulkBtn("#64748b")}>取消选择</button>
      </div>
    </div>
  );

  const si = p.si; const tk = p.siTrack!;
  const isClip = tk === "clips"; const isAudio = tk === "audio"; const isText = tk === "huazi" || tk === "subtitles";
  return (
    <div style={{ width: 256, borderLeft: "1px solid rgba(255,255,255,0.1)", background: "#14141a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {header}
      <div style={{ flex: 1, overflowY: "auto", padding: 12, gap: 10, display: "flex", flexDirection: "column" }} className="se-no">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", padding: "1px 6px", borderRadius: 999 }}>{TRACK_DEF[tk].icon} {TRACK_DEF[tk].label}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>{si.id}</span>
        </div>

        {isText && <Field label="内容"><textarea value={si.content} onChange={e => p.onPatch({ content: e.target.value })} rows={2} className="se-input" style={{ resize: "none" }} /></Field>}
        {(isClip || isAudio) && <Field label="名称"><input value={si.label || si.name || ""} onChange={e => p.onPatch({ label: e.target.value, name: e.target.value })} className="se-input" /></Field>}

        <Field label="起始 (beat)"><input type="number" step="0.5" min="0" value={si.startBeat} onChange={e => p.onPatch({ startBeat: Math.max(0, +e.target.value) })} className="se-input" /></Field>
        <Field label="时长 (beat)"><input type="number" step="0.5" min="0.5" value={si.durationBeats} onChange={e => p.onPatch({ durationBeats: Math.max(0.5, +e.target.value) })} className="se-input" /></Field>
        <Field label={`淡入 (beat)${si.fadeIn != null ? "" : " · 0"}`}><input type="number" step="0.5" min="0" value={si.fadeIn ?? 0} onChange={e => p.onPatch({ fadeIn: Math.max(0, +e.target.value) })} className="se-input" /></Field>
        <Field label={`淡出 (beat)${si.fadeOut != null ? "" : " · 0"}`}><input type="number" step="0.5" min="0" value={si.fadeOut ?? 0} onChange={e => p.onPatch({ fadeOut: Math.max(0, +e.target.value) })} className="se-input" /></Field>

        {isText && <>
          <Field label={`字号 · ${si.fontSize ?? 28}`}><input type="range" min={12} max={64} value={si.fontSize ?? 28} onChange={e => p.onPatch({ fontSize: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label="颜色"><div style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="color" value={si.color || "#ffffff"} onChange={e => p.onPatch({ color: e.target.value })} style={{ width: 32, height: 32, borderRadius: 4, border: "none", cursor: "pointer", padding: 0, background: "transparent" }} /><input value={si.color || "#ffffff"} onChange={e => p.onPatch({ color: e.target.value })} className="se-input" style={{ fontFamily: "monospace", fontSize: 11 }} /></div></Field>
          <Field label="描边色"><div style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="color" value={si.stroke || "#000000"} onChange={e => p.onPatch({ stroke: e.target.value })} style={{ width: 32, height: 32, borderRadius: 4, border: "none", cursor: "pointer", padding: 0, background: "transparent" }} /><label style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}><input type="checkbox" checked={!!si.stroke} onChange={e => p.onPatch({ stroke: e.target.checked ? "#000000" : undefined })} /> 启用描边</label></div></Field>
          <div style={{ display: "flex", gap: 8 }}><label style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}><input type="checkbox" checked={!!si.shadow} onChange={e => p.onPatch({ shadow: e.target.checked })} /> 阴影</label><label style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}><input type="checkbox" checked={!!si.bold} onChange={e => p.onPatch({ bold: e.target.checked })} /> 加粗</label></div>
          <Field label="对齐"><select value={si.align || "center"} onChange={e => p.onPatch({ align: e.target.value })} className="se-input"><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></Field>
          <Field label="动画"><select value={si.animation || "fadeUp"} onChange={e => p.onPatch({ animation: e.target.value })} className="se-input">{ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}</select></Field>
        </>}

        {isClip && <>
          <Field label={`音量 · ${Math.round((si.volume ?? 1) * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={si.volume ?? 1} onChange={e => p.onPatch({ volume: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label={`倍速 · ${si.speed ?? 1}x`}><input type="range" min={0.5} max={2} step={0.1} value={si.speed ?? 1} onChange={e => p.onPatch({ speed: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label={`不透明度 · ${Math.round((si.opacity ?? 1) * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={si.opacity ?? 1} onChange={e => p.onPatch({ opacity: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label={`旋转 · ${si.rotate ?? 0}°`}><input type="range" min={-180} max={180} step={5} value={si.rotate ?? 0} onChange={e => p.onPatch({ rotate: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label={`缩放 · ${si.scale ?? 1}x`}><input type="range" min={0.5} max={2} step={0.05} value={si.scale ?? 1} onChange={e => p.onPatch({ scale: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label="转场（到下一片段）"><select value={si.transition?.type || ""} onChange={e => p.onPatch({ transition: e.target.value ? { type: e.target.value, durationBeats: 2 } : undefined })} className="se-input"><option value="">无</option>{TRANSITION_PRESETS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="特效"><select value={si.effect || ""} onChange={e => p.onPatch({ effect: e.target.value || undefined })} className="se-input"><option value="">无</option>{EFFECT_PRESETS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="调色"><select value={si.grade || ""} onChange={e => p.onPatch({ grade: e.target.value || undefined })} className="se-input"><option value="">原片</option>{COLOR_PRESETS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="滤镜"><select value={si.filter || ""} onChange={e => p.onPatch({ filter: e.target.value || undefined })} className="se-input"><option value="">无</option>{FILTER_PRESETS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        </>}

        {isAudio && <>
          <Field label={`音量 · ${Math.round((si.volume ?? 1) * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={si.volume ?? 1} onChange={e => p.onPatch({ volume: +e.target.value })} style={{ width: "100%" }} /></Field>
          <Field label={`倍速 · ${si.speed ?? 1}x`}><input type="range" min={0.5} max={2} step={0.1} value={si.speed ?? 1} onChange={e => p.onPatch({ speed: +e.target.value })} style={{ width: "100%" }} /></Field>
        </>}

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}><input type="checkbox" checked={!!si.muted} onChange={e => p.onPatch({ muted: e.target.checked })} /> 静音</label>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}><input type="checkbox" checked={!!si.locked} onChange={e => p.onPatch({ locked: e.target.checked })} /> 锁定</label>
        </div>
        <button onClick={p.onDelete} style={{ width: "100%", padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, color: "rgba(248,113,113,0.7)", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.1)", cursor: "pointer", marginTop: 4 }}>🗑 删除此片段</button>
      </div>
    </div>
  );
});

function bulkBtn(color: string): React.CSSProperties {
  return { padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", background: color + "22", border: `1px solid ${color}55`, cursor: "pointer" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{label}</label>{children}</div>);
}
