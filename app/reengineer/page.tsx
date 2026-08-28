"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  FileText,
  Table,
  Copy,
  Wand2,
  Hammer,
  AlertTriangle,
  Music,
  ChevronRight,
  Layers,
  Type,
  Clapperboard,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TeleprompterButton } from "@/components/teleprompter-modal";
import { friendlyError } from "@/lib/ui-error";

/**
 * 展示层归一化：兼容两种生成结果结构。
 *  - /api/viral-engine（粘贴文案三段流水线）返回 { blueprint, script, storyboard, ... }
 *  - /api/flow/start（从分析继续创作）返回 { hook, title, body, cta, shots, tips, ... }（RepurposeResult）
 * 页面统一按 { blueprint, script, storyboard } 渲染；这里只做视图适配，不改变已保存的 asset。
 */
function normalizeEngine(r: any): any {
  if (r && r.blueprint && Array.isArray(r.script)) return r; // viral-engine 原生结构
  const body = Array.isArray(r?.body) ? (r.body as string[]) : [];
  const shots = Array.isArray(r?.shots) ? r.shots : [];
  const script = [
    ...(r?.hook ? [{ text: r.hook, mood: "开场" }] : []),
    ...body.map((t) => ({ text: t, mood: "" })),
    ...(r?.cta ? [{ text: r.cta, mood: "收尾" }] : []),
  ];
  const rows = shots.map((s: any, i: number) => ({
    no: String(i + 1).padStart(2, "0"),
    shot: s.visual || "",
    line: s.line || "",
    cue: s.visual || "",
    sfx: s.sfx || "",
    bgm: s.bgm || (s.phase === "钩子" ? "紧张鼓点 120BPM" : "轻铺底 BGM"),
  }));
  const blueprint = {
    hook_type: "黄金3秒 · 爆款基因组重组",
    hook_analysis: r?.hook || "基于对标爆款的结构，替换成你的主题。",
    core_pain_points: [] as string[],
    narrative_structure: shots.map((s: any) => ({
      stage: s.phase || "段落",
      key_content: s.visual || s.line || "",
      emotion: s.tone || "自然，像聊天",
    })),
    replaceable_slots: {
      product_slot: "",
      target_audience_slot: "",
      problem_slot: "",
    },
  };
  return {
    ...r,
    blueprint,
    script,
    storyboard: {
      rows,
      notes: shots.map((s: any) => s.pitfall).filter(Boolean),
      bgm: shots[0]?.bgm || shots[0]?.sfx || "轻铺底 BGM",
      soundDesign: r.soundDesign || buildSoundDesignFromRows(rows),
    },
  };
}

function buildSoundDesignFromRows(rows: { no: string; shot: string; bgm: string; sfx: string }[]): any {
  const cues = rows.map((r) => ({ shot: `${r.no} · ${r.shot || "镜头"}`, bgm: r.bgm, sfx: r.sfx, emotion: "" }));
  const bgms = Array.from(new Set(cues.map((c) => c.bgm)));
  const sfxs = Array.from(new Set(cues.map((c) => c.sfx)));
  return {
    summary: `【声音设计】配乐：${bgms.join("；")}。音效：${sfxs.join("；")}。前3秒给冲击音，结尾收余韵，避免压过口播。`,
    cues,
  };
}

function ReengineerInner() {
  const sp = useSearchParams();
  const [form, setForm] = React.useState({
    text: sp.get("text") || "",
    topic: sp.get("topic") || "",
    product: sp.get("product") || "",
    persona: sp.get("persona") || "",
    platform: sp.get("platform") || "抖音",
    parentAssetId: sp.get("parentAssetId") || "",
    analysisAssetId: sp.get("analysisAssetId") || "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  // 同一次用户操作复用同一个 requestId（服务端幂等锁依赖它），完成后才允许新建。
  // 避免「快速连点 → 多个不同 requestId → 多次 AI 调用」。useRef 稳定，不随 re-render 改变。
  const requestIdRef = React.useRef<string | null>(null);

  async function run() {
    const topic = (form.topic.trim() || form.product.trim());
    if (!(form.text.trim() || form.analysisAssetId) || !topic) return;
    setBusy(true);
    setError(null);
    try {
      if (!requestIdRef.current) {
        requestIdRef.current =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const requestId = requestIdRef.current;
      const endpoint = form.analysisAssetId ? "/api/flow/start" : "/api/viral-engine";
      const body = form.analysisAssetId
        ? { analysisAssetId: form.analysisAssetId, myTopic: topic, requestId }
        : {
            text: form.text.trim(),
            product: form.product.trim() || topic,
            topic: form.topic.trim() || undefined,
            persona: form.persona.trim() || undefined,
            platform: form.platform.trim() || undefined,
            requestId,
            parentAssetId: form.parentAssetId.trim() || undefined,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(friendlyError(data.error, data.code));
        return;
      }
      setResult(normalizeEngine(data));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setBusy(false);
      requestIdRef.current = null;
    }
  }

  async function doExport(type: "txt" | "csv") {
    if (!result) return;
    const payload = {
      title: (form.topic.trim() || form.product.trim()) || "文案拆解",
      lines: (result.script || []).map((l: any) => ({ text: l.text, mood: l.mood })),
      rows: (result.storyboard?.rows || []).map((r: any) => ({
        no: r.no,
        shot: r.shot,
        line: r.line,
        cue: r.cue,
        sfx: r.sfx,
        bgm: r.bgm,
      })),
      notes: result.storyboard?.notes || [],
      bgm: result.storyboard?.bgm,
      soundDesign: result.storyboard?.soundDesign,
    };
    const res = await fetchWithRetry("/api/viral-engine/export", {
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5">
          <Layers className="h-3.5 w-3.5" /> 三段流水线 · 文案 → 拆解 → 改写 → 分镜
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">文案拆解助手</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          粘贴任意一条对标视频的文案 / 字幕，AI 先拆出它的爆款基因，再换成你的产品做成原创脚本，
          最后生成新手也能照着拍的分镜表。一键导出，拿起就能拍。
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-xs text-muted-foreground">
          这是「用这个视频的方法做我的内容」（复刻/创作）。如果你只是<strong>想研究这个视频为什么有效</strong>，请回到分析报告页看「深度拆解」，这里不会替你改写成产品视频。
        </p>
      </div>

      {!result ? (
        <Card>
          <CardContent className="space-y-5 p-6">
            {form.analysisAssetId ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                <span className="font-medium text-emerald-600 dark:text-emerald-300">✓ 已从你的分析继续</span>
                <span className="text-muted-foreground">—— 使用刚才那份爆款拆解的结构，帮你生成原创脚本。</span>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium">对标视频文案 / 字幕（必填）</label>
                <Textarea
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder={"粘贴对标视频的口播文案或字幕，例如：\n“千万别再乱买护肤品了！很多人用了半年，皮肤反而更差。今天教你三步，看懂成分表……”"}
                  rows={5}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">我的主题 / 创作方向（必填）</label>
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="不卖东西也填主题，如：如何高效学习 / 一杯好咖啡的3个细节" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">我的产品 / 服务（可选）</label>
                <Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="要带货才填，如：我卖的手工辣酱" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">我的人设（可选）</label>
                <Input value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} placeholder="如：毒舌创业者 / 温柔种草阿姨" />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}

            <Button onClick={run} disabled={busy || !(form.text.trim() || form.analysisAssetId) || !(form.topic.trim() || form.product.trim())} className="w-full gap-1.5">
              <Sparkles className="h-4 w-4" />
              {busy ? "三段流水线生成中…" : "一键拆解 + 改写 + 出分镜"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {form.analysisAssetId ? "从你的分析继续，填「主题」即可；要带货再补产品。" : "需填「对标文案」和「主题」；产品为可选（不卖东西就用主题）。生成后可导出提词器或分镜表。"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <EngineResult
          r={result}
          title={form.product.trim() || "文案拆解"}
          onReset={() => setResult(null)}
          onExport={doExport}
        />
      )}
    </div>
  );
}

export default function ReengineerPage() {
  return (
    <Suspense fallback={null}>
      <ReengineerInner />
    </Suspense>
  );
}

/** 最小反馈条：只有 👍/👎，👎 可补充一句话（不强制） */
function FeedbackBar({ assetId }: { assetId?: string }) {
  const [fb, setFb] = React.useState<"positive" | "negative" | null>(null);
  const [showNote, setShowNote] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [sent, setSent] = React.useState(false);

  async function send(v: "positive" | "negative") {
    setFb(v);
    if (v === "negative") return setShowNote(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "feedback_positive", assetId }),
    }).catch(() => {});
    setSent(true);
  }

  async function sendNegative() {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "feedback_negative", assetId, meta: { note: note || null } }),
    }).catch(() => {});
    setSent(true);
  }

  if (sent) {
    return <p className="text-center text-xs text-muted-foreground">感谢反馈，我们会持续优化 👌</p>;
  }
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-sm">这个结果对你有帮助吗？</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant={fb === "positive" ? "default" : "outline"} onClick={() => send("positive")}>👍 有帮助</Button>
        <Button size="sm" variant={showNote ? "default" : "outline"} onClick={() => send("negative")}>👎 不太有用</Button>
      </div>
      {showNote && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="哪里不满意？（可选）"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={sendNegative}>提交反馈</Button>
        </div>
      )}
    </div>
  );
}

function EngineResult({
  r,
  title,
  onReset,
  onExport,
}: {
  r: any;
  title: string;
  onReset: () => void;
  onExport: (type: "txt" | "csv") => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [plan, setPlan] = React.useState<any>(null);
  const [planBusy, setPlanBusy] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const bp = r.blueprint || {};
  const lines = r.script || [];
  const sb = r.storyboard || {};

  function copyLines() {
    const txt = lines.map((l: any) => `${l.mood ? `[${l.mood}] ` : ""}${l.text}`).join("\n");
    navigator.clipboard?.writeText(txt).then(() => setCopied(true)).catch(() => {});
  }

  async function genPlan() {
    if (!r.storyboardAssetId) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardAssetId: r.storyboardAssetId }),
      });
      const d = await res.json();
      if (!res.ok) { setPlanError(friendlyError(d.error, d.code)); return; }
      setPlan(d.plan);
    } catch {
      setPlanError("网络异常，请重试");
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ① 爆款基因拆解 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
          爆款基因拆解
          <Badge className="bg-red-500/15 text-red-600 dark:text-red-300 text-[10px]">黄金 3 秒：{bp.hook_type}</Badge>
        </h2>
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              <span className="font-medium">钩子剖析：</span>{bp.hook_analysis}
            </p>
            {(bp.core_pain_points || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(bp.core_pain_points as string[]).map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">痛点：{p}</Badge>
                ))}
              </div>
            )}
            {(bp.narrative_structure || []).length > 0 && (
              <ol className="space-y-1.5 text-sm">
                {(bp.narrative_structure as any[]).map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{(i + 1).toString().padStart(2, "0")}</span>
                    <span>
                      <span className="font-medium">{s.stage}</span> · {s.key_content}
                      <span className="ml-1 text-xs text-muted-foreground">（情绪：{s.emotion}）</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {bp.replaceable_slots && (
              <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-3">
                <p><span className="font-medium">可替换槽位：</span></p>
                <p>产品 → {bp.replaceable_slots.product_slot}</p>
                <p>人群 → {bp.replaceable_slots.target_audience_slot}</p>
                <p>问题 → {bp.replaceable_slots.problem_slot}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ② 复刻脚本 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
          你的原创口播脚本
          <span className="text-xs font-normal text-muted-foreground">短句、口语、去 AI 味</span>
        </h2>
        <Card>
          <CardContent className="space-y-2 p-5">
            {(lines as any[]).map((l, i) => (
              <p key={i} className="flex gap-2 text-[15px] leading-relaxed">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  {l.mood && <Badge variant="secondary" className="mr-1.5 align-middle text-[10px]">{l.mood}</Badge>}
                  {l.text}
                </span>
              </p>
            ))}
            <Button variant="outline" size="sm" onClick={copyLines} className="mt-2 gap-1.5">
              <Copy className="h-4 w-4" /> {copied ? "已复制" : "复制口播"}
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ③ 导演分镜 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
          导演分镜表
          <span className="text-xs font-normal text-muted-foreground">照着一拍就成</span>
        </h2>
        <Card>
          <CardContent className="overflow-x-auto p-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">镜号</th>
                  <th className="py-2 pr-3">景别 / 镜头动作</th>
                  <th className="py-2 pr-3">口播（含语气）</th>
                  <th className="py-2 pr-3">画面 / 道具</th>
                  <th className="py-2 pr-3">音效</th>
                  <th className="py-2">配乐 / BGM</th>
                </tr>
              </thead>
              <tbody>
                {(sb.rows || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{row.no || i + 1}</td>
                    <td className="py-2 pr-3">{row.shot}</td>
                    <td className="py-2 pr-3">{row.line}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.cue}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.sfx}</td>
                    <td className="py-2 text-muted-foreground">{row.bgm || "轻铺底 BGM"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sb.soundDesign && (
              <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                  <Music className="h-3.5 w-3.5" /> 声音设计说明（可直接交给后期）
                </div>
                <p className="text-foreground/90">{sb.soundDesign.summary}</p>
              </div>
            )}
            {(sb.notes || []).length > 0 && (
              <div className="mt-4 space-y-1.5">
                {(sb.notes as string[]).map((n, i) => (
                  <p key={i} className="flex gap-1.5 text-xs text-amber-600 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {n}
                  </p>
                ))}
              </div>
            )}
            {sb.bgm && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                <Music className="h-3.5 w-3.5" /> 推荐 BGM：{sb.bgm}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ③.5 拍摄计划（Storyboard → Plan） */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
          拍摄计划
        </h2>
        {!plan ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <p className="text-sm">分镜已经完成，下一步：把分镜变成可以直接执行的<strong className="text-primary">拍摄计划</strong>。</p>
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {["每个镜头拍什么", "怎么拍 · 景别 / 机位", "台词 / 旁白", "拍摄顺序", "后期需要注意什么"].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> {x}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">分镜决定"怎么剪"，拍摄计划决定"怎么拍"——两种价值不一样，别混在一起。</p>
            <Button variant="gradient" className="mt-3 gap-1.5" onClick={genPlan} disabled={planBusy || !r.storyboardAssetId}>
              <Hammer className="h-4 w-4" /> {planBusy ? "生成中…" : "继续生成拍摄计划"}
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-semibold">{plan.meta?.title}</p>
              <p className="text-xs text-muted-foreground">你的拍摄计划已完成。照着下面的镜头顺序拍，拍完即可进入后期剪辑。</p>
              <div className="space-y-1.5 text-sm">
                {(plan.clips || []).map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 border-b border-border/50 pb-1.5">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="font-medium">{c.phase}</span> · {c.visual}
                      {c.line ? ` · ${c.line}` : ""}
                      {c.camera ? ` · 机位：${c.camera}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {plan.order && plan.order.length > 0 && (
                <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">拍摄顺序：</span>
                  {plan.order.join(" → ")}
                </p>
              )}
              {plan.postTips && plan.postTips.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground">后期与拍摄注意</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {plan.postTips.map((t: string, i: number) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {planError && <p className="text-xs text-destructive">{planError}</p>}
      </section>

      {/* ⑤ 一键导出 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">5</span>
          一键导出，拿起就拍
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onExport("txt")}
            className="group flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Type className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">提词器（.txt）</p>
              <p className="text-xs text-muted-foreground">每句带顺序，放到提词器里照念</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </button>
          <button
            onClick={() => onExport("csv")}
            className="group flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Table className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">分镜表（.csv）</p>
              <p className="text-xs text-muted-foreground">Excel 打开，能打印的拍摄表格</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </button>
        </div>
        <TeleprompterButton
          className="w-full"
          variant="default"
          title={title}
          lines={((r.script || []).map((l: any) => l.text)).filter(Boolean)}
        />
      </section>

      {/* 反馈（最小）：帮我们判断这些能力是否真的有用 */}
      <FeedbackBar assetId={r.assetId} />

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onReset}>换一条文案再来</Button>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/clinic"><Clapperboard className="h-4 w-4" /> 去账号诊所做对比</Link>
        </Button>
      </div>
    </div>
  );
}
