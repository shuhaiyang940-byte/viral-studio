"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EditorSkeleton {
  hook: string;
  structure: { phase: string; detail: string; secs?: number }[];
}

export interface EditorMine {
  hook: string;
  body: string[];
  cta: string;
}

export interface EditorSliders {
  casual: number;
  emotion: number;
  duration: number;
}

interface Props {
  skeleton: EditorSkeleton;
  mine: EditorMine | null;
  sliders: EditorSliders;
  onSliders: (s: EditorSliders) => void;
  onRegenerate: () => void;
  onTweak?: (action: "casual" | "hook", text: string) => void;
  busy?: boolean;
}

function Slider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#6366F1]"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground/70">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export function SideBySideScriptEditor({
  skeleton,
  mine,
  sliders,
  onSliders,
  onRegenerate,
  onTweak,
  busy,
}: Props) {
  return (
    <div className="space-y-4">
      {/* 顶部控制栏：三滑块 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:gap-5">
        <Slider label="口语化程度" left="正统" right="接地气" value={sliders.casual} onChange={(v) => onSliders({ ...sliders, casual: v })} />
        <Slider label="情绪强度" left="温和" right="强痛点" value={sliders.emotion} onChange={(v) => onSliders({ ...sliders, emotion: v })} />
        <Slider label="目标时长" left="30s" right="60s" value={Math.round((sliders.duration - 30) / 30 * 100)} onChange={(v) => onSliders({ ...sliders, duration: 30 + Math.round(v / 100 * 30) })} />
      </div>

      {/* 左右两列 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：原对标骨架 */}
        <div className="rounded-xl border border-border/70 bg-card/40 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold">原</span>
            原对标骨架
          </p>
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
            <span className="font-medium">[前3秒 Hook]</span> {skeleton.hook}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {skeleton.structure.map((s, i) => (
              <li key={i} className="rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-1.5 text-blue-700 dark:text-blue-200">
                <span className="font-medium">[{s.phase}]</span> {s.detail}
              </li>
            ))}
          </ul>
        </div>

        {/* 右：我的 AI 脚本 */}
        <div className="rounded-xl border border-primary/30 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Wand2 className="h-4 w-4 text-primary" /> 我的 AI 脚本
            </p>
            <Button size="sm" variant="gradient" className="gap-1.5" onClick={onRegenerate} disabled={busy}>
              <Sparkles className="h-3.5 w-3.5" /> {busy ? "生成中…" : "AI 重写"}
            </Button>
          </div>

          {!mine ? (
            <p className="py-6 text-center text-sm text-muted-foreground">调好滑块，点右上角「AI 重写」生成你的版本。</p>
          ) : (
            <div className="space-y-2">
              <TweakLine text={mine.hook} label="钩子" variant="hook" onTweak={onTweak} />
              {mine.body.map((b, i) => (
                <TweakLine key={i} text={b} label={`要点 ${i + 1}`} onTweak={onTweak} />
              ))}
              <TweakLine text={mine.cta} label="CTA" variant="cta" onTweak={onTweak} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 可微调的单行：hover 出现 [更口语化][换个开头] */
function TweakLine({
  text,
  label,
  variant = "default",
  onTweak,
}: {
  text: string;
  label: string;
  variant?: "hook" | "cta" | "default";
  onTweak?: (action: "casual" | "hook", text: string) => void;
}) {
  const cls =
    variant === "hook"
      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300"
      : variant === "cta"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
        : "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-200";
  return (
    <div className="group relative rounded-md border px-3 py-2 text-sm">
      <p className="font-medium text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cls + " rounded-sm px-1"}>{text}</p>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute -top-3 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => onTweak?.("casual", text)}>
            更口语化
          </Button>
          {variant === "hook" && (
            <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => onTweak?.("hook", text)}>
              换个开头
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
