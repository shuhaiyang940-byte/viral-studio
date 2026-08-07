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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  IDEA_OPTIONS,
  STYLE_OPTIONS,
  EFFECT_OPTIONS,
  PRODUCT_OPTIONS,
  CATEGORY_OPTIONS,
  GOAL_OPTIONS,
  BENCHMARKS,
  findPeers,
  findPlaybooks,
  type IdeaType,
  type PeerQuery,
  type Playbook,
} from "@/lib/benchmarks";
import { getSession, type Session } from "@/lib/auth";
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
  const [results, setResults] = React.useState<typeof BENCHMARKS>([]);
  const [playbooks, setPlaybooks] = React.useState<Playbook[]>([]);
  const [session, setSession] = React.useState<Session | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setSession(getSession());
  }, []);

  function toggle(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function runSearch() {
    if (!ideaType) return;
    setLoading(true);
    const q: PeerQuery = {
      ideaType,
      styles,
      effects,
      face,
      productType: productType || undefined,
      category: category || undefined,
      goal: goal || undefined,
    };
    // 模拟「系统自主查找」耗时
    setTimeout(() => {
      setResults(findPeers(q, 6));
      setPlaybooks(findPlaybooks({ ideaType, category, goal, limit: 3 }));
      setLoading(false);
      setStep(3);
    }, 650);
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
          告诉我们你是谁、卖什么、要什么效果，系统会按类目匹配「流量大、效果好」的对标账号与可复刻的爆款套路，
          高级会员还能一键把需求变成 AI 分镜图。
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
                <p className="text-xs text-muted-foreground">系统将按你的条件，从精选对标库里自主匹配排序</p>
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
                  <Button variant="outline" size="sm" onClick={reset}>
                    重新查找
                  </Button>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                    <Users className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">当前库里没有完全匹配的对标，换个条件试试？</p>
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
                          </div>

                          <p className="mt-3 truncate text-xs text-muted-foreground">
                            代表作：{a.sampleTitle}
                          </p>
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
                  以上为「精选对标库」示例数据，系统按你的条件在库内自主匹配排序。后续可补充更多真实账号，
                  或等你具备平台开放平台资质后接入实时搜索。
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
