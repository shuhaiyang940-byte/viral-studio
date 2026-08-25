"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  Search,
  Users,
  Check,
  ArrowRight,
  Sparkles,
  Info,
  UserCheck,
  UserX,
  Crown,
  Clapperboard,
  Lock,
  Plus,
  Flame,
  Wand2,
  Copy,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  IDEA_OPTIONS,
  STYLE_OPTIONS,
  EFFECT_OPTIONS,
  PRODUCT_OPTIONS,
  CATEGORY_OPTIONS,
  GOAL_OPTIONS,
  findPlaybooks,
  blackHorseIndex,
  isBlackHorse,
  type IdeaType,
  type BenchmarkItem,
  type Playbook,
} from "@/lib/benchmarks";
import { useSession } from "@/lib/auth";
import { saveReport, saveStoryboard } from "@/lib/storage";
import { briefToStoryboard } from "@/lib/storyboard";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

const PLATFORMS = ["抖音", "小红书", "视频号", "快手"] as const;

type BenchForm = {
  name: string;
  platform: string;
  ideaType: string;
  followers: string;
  engagementRate: string;
  reason: string;
  sampleTitle: string;
  styles: string;
  effects: string;
  face: boolean;
};

const EMPTY_FORM: BenchForm = {
  name: "",
  platform: "抖音",
  ideaType: "sell",
  followers: "",
  engagementRate: "",
  reason: "",
  sampleTitle: "",
  styles: "",
  effects: "",
  face: true,
};

export default function FindPeerPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [ideaType, setIdeaType] = React.useState<IdeaType | null>(null);
  const [styles, setStyles] = React.useState<string[]>([]);
  const [effects, setEffects] = React.useState<string[]>([]);
  const [face, setFace] = React.useState<"face" | "noface" | "any">("any");
  const [productType, setProductType] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [goal, setGoal] = React.useState<string>("");
  const [title, setTitle] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<BenchmarkItem[]>([]);
  const [playbooks, setPlaybooks] = React.useState<Playbook[]>([]);
  const [trackingId, setTrackingId] = React.useState<string | null>(null);
  /** 会话以服务端 Cookie 为准 */
  const { session } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BenchForm>(EMPTY_FORM);
  // ── 爆款基因重组（一键变成我的视频）──
  const [repOpen, setRepOpen] = React.useState(false);
  const [repTarget, setRepTarget] = React.useState<Playbook | null>(null);
  const [repForm, setRepForm] = React.useState({ myTopic: "", myPersona: "", platform: "" });
  const [repBusy, setRepBusy] = React.useState(false);
  const [repResult, setRepResult] = React.useState<any>(null);
  const [repError, setRepError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  function toggle(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function runSearch() {
    if (!ideaType) return;
    setLoading(true);
    setStep(3);
    try {
      const params = new URLSearchParams();
      params.set("ideaType", ideaType);
      params.set("face", face);
      if (styles.length) params.set("styles", styles.join(","));
      if (effects.length) params.set("effects", effects.join(","));
      if (productType) params.set("productType", productType);
      const res = await fetch(`/api/benchmarks?${params.toString()}`);
      const data = await res.json();
      setResults(data.items ?? []);
      setPlaybooks(findPlaybooks({ ideaType, category, goal, limit: 3 }));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1);
    setIdeaType(null);
    setStyles([]);
    setEffects([]);
    setFace("any");
    setProductType("");
    setCategory("");
    setGoal("");
    setTitle("");
    setResults([]);
    setPlaybooks([]);
  }

  /** 打开「一键变成我的视频」弹窗，带上选中的爆款套路 */
  function openRepurpose(p: Playbook) {
    setRepTarget(p);
    setRepResult(null);
    setRepError(null);
    setRepForm({ myTopic: "", myPersona: "", platform: "" });
    setRepOpen(true);
  }

  /** 套用该套路的骨架，换成本人素材，生成可照拍脚本 */
  async function submitRepurpose() {
    if (!repTarget || !repForm.myTopic.trim()) return;
    setRepBusy(true);
    setRepError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook: repTarget,
          myTopic: repForm.myTopic.trim(),
          myPersona: repForm.myPersona.trim() || undefined,
          platform: repForm.platform.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRepError(data.error || "生成失败，请稍后重试");
        return;
      }
      setRepResult(data);
    } catch {
      setRepError("网络异常，请检查连接后重试");
    } finally {
      setRepBusy(false);
    }
  }

  async function toggleTrack(a: BenchmarkItem) {
    if (!mounted || !session) {
      router.push("/login?redirect=/find-peer");
      return;
    }
    if (trackingId) return;
    setTrackingId(a.id);
    try {
      const res = a.tracked
        ? await fetch(`/api/benchmarks/tracked?benchmarkId=${a.id}`, { method: "DELETE" })
        : await fetch("/api/benchmarks/tracked", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ benchmarkId: a.id }),
          });
      // 请求成功才翻转 UI，避免「假关注」
      if (res.ok) {
        setResults((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, tracked: !x.tracked } : x))
        );
      } else if (res.status === 401) {
        router.push("/login?redirect=/find-peer");
      }
    } catch {
      /* 网络异常时保持原状即可 */
    } finally {
      setTrackingId(null);
    }
  }

  async function submitAccount() {
    if (!form.name.trim()) return;
    if (!mounted || !session) {
      router.push("/login?redirect=/find-peer");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          platform: form.platform,
          ideaType: form.ideaType,
          followers: Number(form.followers) || 0,
          engagementRate: Number(form.engagementRate) || 0,
          reason: form.reason.trim(),
          sampleTitle: form.sampleTitle.trim(),
          styles: form.styles
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          effects: form.effects
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          face: form.face,
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        setForm(EMPTY_FORM);
        runSearch();
      } else {
        const d = await res.json().catch(() => ({}));
        setAddError(d.error || (res.status === 503 ? "服务端未配置数据库，暂时无法提交" : "提交失败，请稍后重试"));
        if (res.status === 401) router.push("/login?redirect=/find-peer");
      }
    } catch {
      setAddError("网络异常，请检查连接后重试");
    } finally {
      setAddLoading(false);
    }
  }

  /** 高级功能：由需求入口直接生成 AI 分镜（会员可用，免费软引导） */
  function generateStoryboard() {
    if (!ideaType) return;
    const { report, storyboard } = briefToStoryboard({
      ideaType,
      category: category || "通用",
      goal: goal || "涨粉",
      styles,
      effects,
      productType: productType || undefined,
      face,
      title,
    });
    saveReport(report);
    saveStoryboard(storyboard);
    router.push(`/storyboard?id=${storyboard.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* 头部 */}
      <div className="text-center">
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> 找对标
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight">先选你的想法，系统帮你找对标</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          告诉我们你是谁、卖什么、要什么效果，系统会按类目从对标库里匹配「流量大、效果好」的账号与可复刻的爆款套路，
          登录后即可关注追踪、或补充你自己的对标账号。
        </p>
      </div>

      {/* 步骤指示 */}
      <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-xs">
        {[
          { n: 1, label: "选想法" },
          { n: 2, label: "填条件" },
          { n: 3, label: "看对标" },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <span
              className={
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors " +
                (step === s.n
                  ? "bg-primary text-white"
                  : step > s.n
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground")
              }
            >
              {step > s.n && <Check className="h-3.5 w-3.5" />}
              {s.label}
            </span>
            {i < 2 && <span className="h-px w-6 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-8">
        {/* Step 1：选想法 */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {IDEA_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setIdeaType(o.id);
                  setStep(2);
                }}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-lg font-semibold">{o.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  下一步 <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2：填条件 */}
        {step === 2 && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  你选了：<span className="text-primary">{IDEA_OPTIONS.find((o) => o.id === ideaType)?.label}</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  重选
                </Button>
              </div>

              {/* 风格 */}
              <div>
                <p className="mb-2 text-sm font-medium">想要的风格（可多选）</p>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((s) => (
                    <Chip key={s} active={styles.includes(s)} onClick={() => setStyles(toggle(styles, s))}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* 效果 */}
              <div>
                <p className="mb-2 text-sm font-medium">想要的效果（可多选）</p>
                <div className="flex flex-wrap gap-2">
                  {EFFECT_OPTIONS.map((e) => (
                    <Chip key={e} active={effects.includes(e)} onClick={() => setEffects(toggle(effects, e))}>
                      {e}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* 类目 */}
              <div>
                <p className="mb-2 text-sm font-medium">你的类目（决定给你哪套爆款套路）</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((c) => (
                    <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* 目标 */}
              <div>
                <p className="mb-2 text-sm font-medium">你的目标</p>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((g) => (
                    <Chip key={g} active={goal === g} onClick={() => setGoal(goal === g ? "" : g)}>
                      {g}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* 标题（选填） */}
              <div>
                <p className="mb-2 text-sm font-medium">给你的视频起个名字（选填）</p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="留空则由系统按套路默认命名"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* 露脸 */}
              <div>
                <p className="mb-2 text-sm font-medium">露不露脸</p>
                <div className="inline-flex rounded-full border border-border bg-muted p-1">
                  {(
                    [
                      { id: "any", label: "不限", icon: null },
                      { id: "face", label: "露脸", icon: <UserCheck className="h-4 w-4" /> },
                      { id: "noface", label: "不露脸", icon: <UserX className="h-4 w-4" /> },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFace(f.id)}
                      className={
                        "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                        (face === f.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {f.icon}
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 货品种类（仅卖货） */}
              {ideaType === "sell" && (
                <div>
                  <p className="mb-2 text-sm font-medium">货的种类</p>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_OPTIONS.map((p) => (
                      <Chip key={p} active={productType === p} onClick={() => setProductType(productType === p ? "" : p)}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">系统将按你的条件，从对标库里自主匹配排序</p>
                <Button onClick={runSearch} variant="gradient">
                  <Search className="h-4 w-4" /> 帮我找对标
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3：结果 */}
        {step === 3 && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Sparkles className="h-8 w-8 animate-pulse text-primary" />
                <p className="text-sm">系统正在为你匹配对标账号…</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    为你找到 <span className="font-semibold text-foreground">{results.length}</span> 个对标账号
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="h-4 w-4" /> 添加对标账号
                    </Button>
                    <Button variant="outline" size="sm" onClick={reset}>
                      重新查找
                    </Button>
                  </div>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                    <Users className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">当前库里没有完全匹配的对标，换个条件试试？也可以点右上角「添加对标账号」补充。</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {results.map((a) => (
                      <Card key={a.id} className="overflow-hidden">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-semibold">{a.name}</h3>
                                {a.face ? (
                                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                                    <UserCheck className="h-3 w-3" /> 露脸
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                                    <UserX className="h-3 w-3" /> 不露脸
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {a.handle} · {a.platform}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold">{a.followers}万</p>
                              <p className="text-[10px] text-muted-foreground">粉丝</p>
                            </div>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm text-foreground/90">{a.reason}</p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {a.styles.slice(0, 3).map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {s}
                              </Badge>
                            ))}
                            <Badge variant="warning" className="text-[10px]">
                              互动 {a.engagementRate}%
                            </Badge>
                            {isBlackHorse(a) ? (
                              <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-300 text-[10px]" title="互动率高 + 粉丝量相对小 = 小号大爆款，性价比最高，优先照抄">
                                <Flame className="mr-0.5 h-3 w-3" /> 黑马指数 {blackHorseIndex(a)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]" title="互动率 / 粉丝量估算，示例库参考">
                                黑马指数 {blackHorseIndex(a)}
                              </Badge>
                            )}
                          </div>

                          <p className="mt-3 truncate text-xs text-muted-foreground">
                            代表作：{a.sampleTitle}
                          </p>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {a.isSeed ? "精选库" : "用户贡献"}
                            </span>
                            <Button
                              size="sm"
                              variant={a.tracked ? "outline" : "default"}
                              disabled={trackingId === a.id}
                              onClick={() => toggleTrack(a)}
                            >
                              {a.tracked ? "已关注" : "关注"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* 爆款套路：比账号更可操作，直接照拍 */}
                {playbooks.length > 0 && (
                  <div className="mt-10">
                    <div className="mb-3 flex items-center gap-2">
                      <Clapperboard className="h-4 w-4 text-primary" />
                      <h2 className="text-lg font-semibold">给你匹配的爆款套路</h2>
                      <Badge variant="secondary" className="text-[10px]">照着拍就能复刻</Badge>
                      <Link
                        href="/reengineer"
                        className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        没套路？粘贴文案三步拆解 <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {playbooks.map((p, idx) => (
                        <Card key={p.id} className={idx === 0 ? "border-primary/40" : ""}>
                          <CardContent className="space-y-3 p-5">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{p.title}</h3>
                                {idx === 0 && (
                                  <Badge className="text-[10px]">最匹配</Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                适用：{p.categories.join(" / ")} · {p.goals.join(" / ")}
                              </p>
                            </div>
                            <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                              <span className="font-medium text-primary">钩子：</span>
                              {p.hook}
                            </p>
                            <ol className="space-y-1.5 text-sm">
                              {p.structure.map((s, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                    {s.secs}s
                                  </span>
                                  <span>
                                    <span className="font-medium">{s.phase}</span> · {s.detail}
                                  </span>
                                </li>
                              ))}
                            </ol>
                            <p className="text-xs text-muted-foreground">{p.note}</p>
                            <Button
                              size="sm"
                              className="mt-3 w-full gap-1.5"
                              onClick={() => openRepurpose(p)}
                            >
                              <Wand2 className="h-4 w-4" /> 一键变成我的视频
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 分镜图（高级功能） */}
                <div className="mt-8 rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/5 to-accent/5 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Clapperboard className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">一键生成 AI 分镜图</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          把上面的需求直接变成可拍的分镜头表（含场景示意），高级会员专享。
                        </p>
                      </div>
                    </div>
                    {mounted && session?.isPro ? (
                      <Button onClick={generateStoryboard} className="gap-1.5">
                        <Sparkles className="h-4 w-4" /> 生成 AI 分镜图
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="gap-1.5">
                        <Link href="/pricing?feature=storyboard">
                          <Lock className="h-4 w-4" /> 升级解锁（高级功能）
                        </Link>
                      </Button>
                    )}
                  </div>
                  {mounted && !session?.isPro && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Crown className="h-3.5 w-3.5 text-primary" />
                      免费 / 普通会员可看完整对标与爆款套路；AI 分镜图需升级普通会员（按需求自动出分镜）。
                    </p>
                  )}
                </div>

                <p className="mx-auto mt-6 flex max-w-2xl items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  对标账号来自实时数据库：精选库由平台维护，登录后你可以关注追踪、或补充自己的对标账号。
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 添加对标账号 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加对标账号</DialogTitle>
            <DialogDescription>补充你自己的对标账号，提交后会进入对标库并立即出现在结果里。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">账号名称 *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：XX说运营" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">平台</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm({ ...form, platform: p })}
                      className={
                        "rounded-full border px-3 py-1 text-xs " +
                        (form.platform === p ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">类型</label>
                <div className="flex flex-wrap gap-1.5">
                  {IDEA_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setForm({ ...form, ideaType: o.id })}
                      className={
                        "rounded-full border px-3 py-1 text-xs " +
                        (form.ideaType === o.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={form.face} onChange={(e) => setForm({ ...form, face: e.target.checked })} />
                  露脸
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">粉丝量（万）</label>
                <Input value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} placeholder="如：120" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">互动率（%）</label>
                <Input value={form.engagementRate} onChange={(e) => setForm({ ...form, engagementRate: e.target.value })} placeholder="如：8" inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">为什么值得对标</label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="如：人设反差强、评论区运营到位" rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">代表作标题</label>
              <Input value={form.sampleTitle} onChange={(e) => setForm({ ...form, sampleTitle: e.target.value })} placeholder="如：一条视频涨粉 10 万的方法" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">风格（逗号分隔）</label>
                <Input value={form.styles} onChange={(e) => setForm({ ...form, styles: e.target.value })} placeholder="测评, 干货" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">效果（逗号分隔）</label>
                <Input value={form.effects} onChange={(e) => setForm({ ...form, effects: e.target.value })} placeholder="涨粉快, 互动强" />
              </div>
            </div>
          </div>
          {addError && (
            <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={submitAccount} disabled={addLoading || !form.name.trim()}>
              {addLoading ? "提交中…" : "提交"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 一键变成我的视频 */}
      <Dialog open={repOpen} onOpenChange={setRepOpen}>
        <DialogContent className={repResult ? "sm:max-w-4xl" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>一键变成我的视频</DialogTitle>
            <DialogDescription>
              套用「{repTarget?.title}」的爆款骨架，把内容换成你自己的，3 秒拿到一份能直接开拍的脚本。
            </DialogDescription>
          </DialogHeader>

          {!repResult ? (
            <>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">你的主题 / 产品（必填）</label>
                  <Input
                    value={repForm.myTopic}
                    onChange={(e) => setRepForm({ ...repForm, myTopic: e.target.value })}
                    placeholder="如：我卖的无糖茶饮 / 我是教人学做饭的"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">我的人设（可选）</label>
                  <Input
                    value={repForm.myPersona}
                    onChange={(e) => setRepForm({ ...repForm, myPersona: e.target.value })}
                    placeholder="如：十年小吃店主 / 理性测评号"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">发布平台（可选）</label>
                  <Input
                    value={repForm.platform}
                    onChange={(e) => setRepForm({ ...repForm, platform: e.target.value })}
                    placeholder="如：抖音"
                  />
                </div>
              </div>

              {repError && (
                <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {repError}
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRepOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitRepurpose} disabled={repBusy || !repForm.myTopic.trim()}>
                  {repBusy ? "生成中…" : "生成我的脚本"}
                </Button>
              </div>
            </>
          ) : (
            <CompareView
              playbook={repTarget}
              r={repResult}
              onRegen={() => setRepResult(null)}
              onClose={() => setRepOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 对比式结果：左「对标爆款」右「AI 改写版」，红=钩子 蓝=痛点 绿=转化(CTA) */
function CompareView({
  playbook,
  r,
  onRegen,
  onClose,
}: {
  playbook: any;
  r: any;
  onRegen: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  function copyAll() {
    const lines = [
      `【标题】${r.title}`,
      `【钩子】${r.hook}`,
      ...(r.body || []).map((b: string) => `· ${b}`),
      `【结尾】${r.cta}`,
      "",
      "【分镜表】",
      ...(r.shots || []).map(
        (s: any, i: number) =>
          `${i + 1}. ${s.phase}（${s.durationSec}s）\n   画面：${s.visual}\n   台词：${s.line}\n   语调：${s.tone}\n   避坑：${s.pitfall}\n   音效：${s.sfx}`
      ),
      "",
      "【落地建议】",
      ...(r.tips || []).map((t: string) => `· ${t}`),
    ].join("\n");
    navigator.clipboard?.writeText(lines).then(() => setCopied(true)).catch(() => {});
  }

  return (
    <div className="space-y-4">
      {/* 图例 */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <Badge className="bg-red-500/15 text-red-600 dark:text-red-300 text-[10px]">红 = 钩子（前 3 秒）</Badge>
        <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300 text-[10px]">蓝 = 痛点 / 铺垫</Badge>
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px]">绿 = 转化（CTA）</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：对标爆款 */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-bold">{playbook?.title ? "原" : "爆"}</span>
            对标爆款
          </p>
          <p className="text-lg font-semibold">{playbook?.title}</p>
          {playbook?.hook && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              <span className="font-medium">钩子：</span>
              {playbook.hook}
            </p>
          )}
          <ol className="space-y-1.5 text-sm">
            {(playbook?.structure || []).map((s: any, i: number) => (
              <li key={i} className="flex gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-1.5 text-blue-700 dark:text-blue-200">
                <span className="shrink-0 font-mono text-xs opacity-70">{s.secs}s</span>
                <span>
                  <span className="font-medium">{s.phase}</span> · {s.detail}
                </span>
              </li>
            ))}
          </ol>
          {playbook?.note && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
              <span className="font-medium">转化 / 为什么能打：</span> {playbook.note}
            </p>
          )}
        </div>

        {/* 右：AI 改写版 */}
        <div className="space-y-3 rounded-xl border border-primary/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="h-4 w-4 text-primary" /> AI 为你改写的版本
          </p>
          <p className="text-lg font-semibold">{r.title}</p>
          {r.hook && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              <span className="font-medium">钩子：</span> {r.hook}
            </p>
          )}
          {(r.body || []).length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {(r.body as string[]).map((b, i) => (
                <li key={i} className="rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-1.5 text-blue-700 dark:text-blue-200">
                  <span className="mr-1 font-mono text-xs opacity-70">{(i + 1).toString().padStart(2, "0")}</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
          {r.cta && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
              <span className="font-medium">转化：</span> {r.cta}
            </p>
          )}

          {(r.shots || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">分镜表（照着拍）</p>
              {(r.shots as any[]).map((s, i) => (
                <div key={i} className="rounded-lg border border-border p-2.5">
                  <p className="text-sm font-semibold">
                    {i + 1}. {s.phase}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">({s.durationSec}s)</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">画面：{s.visual}</p>
                  <p className="mt-0.5 text-sm">{s.line}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">语调：{s.tone}</Badge>
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px]">避坑：{s.pitfall}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(r.tips || []).length > 0 && (
            <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              {(r.tips as string[]).map((t, i) => (
                <p key={i} className="mb-1 flex gap-1.5">
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" /> {t}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>关闭</Button>
        <Button variant="outline" onClick={onRegen} className="gap-1.5">
          <Wand2 className="h-4 w-4" /> 再来一次
        </Button>
        <Button onClick={copyAll} className="gap-1.5">
          <Copy className="h-4 w-4" /> {copied ? "已复制" : "复制全文"}
        </Button>
      </div>
    </div>
  );
}
