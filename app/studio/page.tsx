"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  Crown,
  Wand2,
  Type,
  Table,
  Clapperboard,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PLAYBOOKS, type Playbook } from "@/lib/benchmarks";
import { SideBySideScriptEditor, type EditorMine, type EditorSkeleton } from "@/components/side-by-side-editor";
import { BlurredVipUnlockCard } from "@/components/blurred-vip-unlock";
import { TeleprompterButton } from "@/components/teleprompter-modal";

const PILLS = ["知识口播", "美妆种草", "数码带货", "创业干货"];

function skeletonFrom(p: Playbook): EditorSkeleton {
  return {
    hook: p.hook,
    structure: p.structure.map((seg) => ({ phase: seg.phase, detail: seg.detail, secs: seg.secs })),
  };
}

function StudioInner() {
  const sp = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Playbook>(PLAYBOOKS[0]);
  const [pill, setPill] = React.useState(PILLS[0]);
  const [product, setProduct] = React.useState(sp.get("product") || "");
  const [platform, setPlatform] = React.useState(sp.get("platform") || "抖音");
  const [sliders, setSliders] = React.useState({ casual: 70, emotion: 60, duration: 45 });
  const [busy, setBusy] = React.useState(false);
  const [mine, setMine] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const list = PLAYBOOKS.filter(
    (i) => !query || i.title.includes(query) || i.categories.some((c) => c.includes(query))
  );
  const skeleton = React.useMemo(() => skeletonFrom(selected), [selected]);

  async function regenerate() {
    if (!product.trim() && !selected.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook: selected,
          myTopic: product.trim() || selected.title,
          myPersona: "普通创作者",
          platform,
          casual: sliders.casual,
          emotion: sliders.emotion,
          duration: sliders.duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败");
        return;
      }
      setMine(data);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function doExport(type: "txt" | "csv") {
    if (!mine) return;
    const payload = {
      title: product.trim() || "爆款复刻",
      lines: [mine.hook, ...(mine.body || []), mine.cta].filter(Boolean).map((t: string) => ({ text: t })),
      rows: (mine.shots || []).map((s: any, i: number) => ({ no: String(i + 1).padStart(2, "0"), shot: s.visual, line: s.line, cue: s.pitfall, sfx: s.sfx })),
      notes: mine.tips || [],
      bgm: (mine.shots?.[0]?.sfx || "").replace("轻铺底 BGM", ""),
    };
    const res = await fetch("/api/viral-engine/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${payload.title}-${type === "txt" ? "提词器" : "分镜表"}.${type}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top Header（画布内） */}
      <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-3">
          <Clapperboard className="h-5 w-5 text-primary" />
          <span className="font-semibold">Find-Peer 对标爆款画布</span>
        </div>
        <div className="hidden gap-2 md:flex">
          {PILLS.map((p) => (
            <button
              key={p}
              onClick={() => setPill(p)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                pill === p ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <Button asChild size="sm" variant="gradient" className="glow-purple gap-1.5">
          <Link href="/pricing"><Crown className="h-4 w-4" /> 升级 VIP</Link>
        </Button>
      </div>

      {/* 三栏主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：爆款公式库 */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border/60 p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜爆款公式 / 赛道" className="pl-8" />
          </div>
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">爆款公式库</p>
          <div className="space-y-2">
            {list.slice(0, 8).map((i) => (
              <motion.button
                key={i.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelected(i)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected.id === i.id ? "border-primary/60 bg-primary/10" : "border-border/60 bg-card/40 hover:border-foreground/30"
                }`}
              >
                <span className="text-sm font-semibold">{i.title}</span>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.hook}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {i.categories.slice(0, 2).map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        </aside>

        {/* 中栏：爆款基因重组 */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-300">前3秒 Hook</p>
              <p className="mt-1 text-xs text-red-600/90 dark:text-red-200/90">{skeleton.hook}</p>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-300">痛点 / 结构</p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">{skeleton.structure[1]?.detail}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">转化 CTA</p>
              <p className="mt-1 text-xs text-emerald-600/90 dark:text-emerald-200/90">{skeleton.structure[3]?.detail}</p>
            </div>
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">你的产品 / 主题</label>
              <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="默认用该对标的代表作" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">发布平台</label>
              <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="抖音" />
            </div>
          </div>
          {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

          <SideBySideScriptEditor
            skeleton={skeleton}
            mine={
              mine
                ? { hook: mine.hook, body: mine.body, cta: mine.cta }
                : null
            }
            sliders={sliders}
            onSliders={setSliders}
            onRegenerate={regenerate}
            onTweak={() => setSliders((s) => ({ ...s, casual: Math.min(100, s.casual + 10) }))}
            busy={busy}
          />
        </main>

        {/* 右栏：拍摄落地 */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border/60 p-3">
          <div className="mb-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Clapperboard className="h-4 w-4 text-primary" /> 导演分镜</p>
            {!mine || !mine.shots?.length ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">生成 AI 脚本后，这里会出现分镜表</p>
            ) : (
              <div className="space-y-2">
                {mine.shots.map((s: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/70 bg-card/40 p-2.5">
                    <p className="text-xs font-semibold">{i + 1}. {s.phase} <span className="font-normal text-muted-foreground">({s.durationSec}s)</span></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.visual}</p>
                    <p className="mt-0.5 text-sm">{s.line}</p>
                    {s.pitfall && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{s.pitfall}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <BlurredVipUnlockCard />

          {/* 底部固定操作栏 */}
          <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-border/60 bg-background/80 p-2 backdrop-blur">
            <TeleprompterButton
              className="flex-1"
              title={product.trim() || "爆款复刻"}
              lines={mine ? [mine.hook, ...(mine.body || []), mine.cta].filter(Boolean) : []}
            />
            <Button size="sm" className="flex-1 gap-1" onClick={() => doExport("csv")} disabled={!mine}>
              <Table className="h-3.5 w-3.5" /> 分镜表
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioInner />
    </Suspense>
  );
}
