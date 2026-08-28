"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Link2,
  Loader2,
  Check,
  Image as ImageIcon,
  Brain,
  FileBarChart,
  RefreshCw,
  Pencil,
  Tags,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Crown,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BETA_OPEN } from "@/lib/beta";
import { friendlyError } from "@/lib/ui-error";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { saveReport } from "@/lib/storage";
import { getProfile, LEVEL_LABELS } from "@/lib/onboarding";
import { REFERENCE_TYPES, type OnboardingProfile } from "@/lib/types";
import { mockReferenceSignal } from "@/lib/reference-signal";
import { useSession } from "@/lib/auth";
import { fetchQuota, type ClientQuota } from "@/lib/quota-client";
import { upload } from "@vercel/blob/client";
import { selectAnalyzeEndpoint } from "@/lib/creation-input";
import { fetchWithRetry } from "@/lib/fetch-retry";

const PIPELINE = [
  { icon: Upload, label: "上传视频" },
  { icon: ImageIcon, label: "AI 看画面 + 转语音" },
  { icon: Brain, label: "AI 分析" },
  { icon: FileBarChart, label: "生成报告" },
];

export default function AnalyzePage() {
  const router = useRouter();
  // 从 localStorage 读取已保存的新手档案；没有则引导去 /onboarding
  const [profile, setProfile] = React.useState<OnboardingProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = React.useState(false);
  const [skipped, setSkipped] = React.useState(false);

  React.useEffect(() => {
    const saved = getProfile();
    if (saved) {
      setProfile(saved);
    } else {
      setNeedsOnboarding(true);
    }
  }, []);

  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [refType, setRefType] = React.useState("");
  const [step, setStep] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [showLinkHelp, setShowLinkHelp] = React.useState(false);
  const { session } = useSession();
  const [quota, setQuota] = React.useState<ClientQuota | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // 同一次用户操作复用同一个 requestId（服务端做 5 分钟重复提交保护），完成后才允许新建。
  const requestIdRef = React.useRef<string | null>(null);

  // 从首页「一键生成」跳转过来时：带 ?url= 则预填视频链接并切到 URL 模式
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const u = q.get("url") || "";
    if (u) { setMode("url"); setUrl(u); }
    const rt = q.get("refType") || "";
    if (rt) setRefType(rt);
  }, []);

  // 配额来自服务端：登录 / 升级后要立刻重算
  React.useEffect(() => {
    let alive = true;
    fetchQuota().then((q) => {
      if (alive) setQuota(q);
    });
    return () => {
      alive = false;
    };
  }, [session]);

  const canStart =
    ((mode === "upload" && !!file) || (mode === "url" && url.trim().length > 0)) &&
    refType.length > 0;

  // 免费 / 匿名用户当天配额用尽 → 拦截（会员不限）
  const quotaBlocked =
    !!quota && quota.limit !== null && quota.remaining === 0;

  async function start() {
    if (quotaBlocked || !canStart || loading) return;
    setLoading(true);
    setError(null);
    if (!requestIdRef.current) {
      requestIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const requestId = requestIdRef.current;
    for (let i = 0; i < PIPELINE.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 750));
    }
    try {
      const res =
        mode === "upload" && file
          ? await (async () => {
              // 优先走服务器化直传（Vercel Blob）：先拿预签名票据
              const ticket = await fetchWithRetry("/api/analyze/upload-url", {
                method: "POST",
              })
                .then((r) => r.json())
                .catch(() => ({ blobMode: false }));
              if (ticket.blobMode) {
                const blob = await upload(file.name, file, {
                  access: "public",
                  handleUploadUrl: "/api/blob/upload",
                  contentType: file.type || "video/mp4",
                });
                return fetchWithRetry("/api/analyze/url", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    videoUrl: blob.url,
                    title: title.trim(),
                    refType,
                    profile,
                  }),
                });
              }
              // 本机模式（未配置 Blob）：直接 multipart 上传
              const fd = new FormData();
              fd.append("video", file);
              fd.append("title", title.trim());
              fd.append("refType", refType);
              fd.append("profile", profile ? JSON.stringify(profile) : "");
              fd.append("requestId", requestId);
              return fetchWithRetry("/api/analyze/upload", { method: "POST", body: fd });
            })()
          : await fetchWithRetry(selectAnalyzeEndpoint(mode), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(mode === "url"
                  ? { videoUrl: url, refType, profile }
                  : { source: url, profile, refType }),
                title: title.trim() || undefined,
                requestId,
              }),
            });
      const report = await res.json();
      if (!res.ok) {
        if (report?.code === "QUOTA_EXCEEDED") {
          setLoading(false);
          setStep(-1);
          setQuota({
            limit: report.quota?.limit ?? 1,
            used: 1,
            remaining: 0,
            isPro: false,
            generation: report.quota?.generation ?? [],
            resetAt: report.quota?.resetAt ?? "",
          });
          return;
        }
        throw new Error(report.error || "分析失败，请重试");
      }
      saveReport(report);
      // 服务端已消耗配额，刷新剩余次数
      fetchQuota().then((q) => {
        if (q) setQuota(q);
      });
      requestIdRef.current = null;
      router.push(`/report?id=${report.id}`);
    } catch (e) {
      setLoading(false);
      setStep(-1);
      requestIdRef.current = null;
      setError(friendlyError(e instanceof Error ? e.message : undefined));
    }
  }

  if ((needsOnboarding || !profile) && !skipped) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">先花 30 秒认识你</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          为了给你更精准的拆解报告，我们需要先了解你的剪辑基础和方向。
          这一步只需要 30 秒，填完之后所有分析都会按你的情况定制。
        </p>
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-5 text-left text-sm space-y-3">
          <p className="font-medium text-foreground">我们会问这些：</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              你的剪辑基础（完全新手 / 做过几个 / 有经验）
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              想做的内容类型（口播 / Vlog / 美食 / 其他…）
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              主要发布平台和每周投入时间
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              你最头疼的问题（不知道拍什么 / 节奏拖 / 不会特效…）
            </li>
          </ul>
        </div>
        <Button
          asChild
          variant="gradient"
          size="lg"
          className="mt-8"
        >
          <a href="/onboarding">
            开始填写 <ArrowRight className="ml-1 h-4 w-4" />
          </a>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          视频经加密通道交给 AI 简短分析，服务器不保存你的原片，分析结果可在「我的」里随时清除。
        </p>
        <Button variant="ghost" className="mt-4 text-sm" onClick={() => setSkipped(true)}>
          先跳过，直接开始分析（不填档案也能用）
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">AI 视频分析</h1>
        <p className="mt-3 text-muted-foreground">
          上传一个短视频，或粘贴视频链接，AI 自动生成「爆款拆解报告」。
        </p>
      </div>

      {/* 新手档案提示条 */}
      {profile && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-foreground/90">
            <Badge variant="success" className="gap-1">
              已按你的基础定制
            </Badge>
            剪辑基础：{LEVEL_LABELS[profile.level]}
            {profile.painPoints.length > 0 &&
              ` · 重点解决：${profile.painPoints.slice(0, 2).join("、")}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 px-2 text-xs"
          >
            <a href="/onboarding">
              <Pencil className="mr-1 h-3.5 w-3.5" /> 重新填写
            </a>
          </Button>
        </div>
      )}

      {quota && quota.limit !== null && quota.remaining !== null && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {quota.remaining === 0 ? (
            <>
              <Lock className="h-3.5 w-3.5 text-warning" />{" "}
              {BETA_OPEN
                ? "今日免费额度已用完，Beta 公测期间额度每天自动刷新，可明日再试"
                : "今日分析次数已用完，升级会员可无限次分析"}
            </>
          ) : (
            <>
              <Crown className="h-3.5 w-3.5 text-primary" />{" "}
              {BETA_OPEN
                ? `今日还可分析 ${quota.remaining} 次（Beta 每日免费额度）`
                : `今日还可分析 ${quota.remaining} 次（每日 ${quota.limit} 次，升级解锁更多）`}
            </>
          )}
        </div>
      )}

      {quotaBlocked ? (
        <QuotaExhaustedCard onUpgrade={() => router.push("/pricing")} />
      ) : (
        <>
        <Card className="mt-6">
        <CardContent className="p-6">
          {/* 模式切换 */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {([
              { id: "upload", label: "上传视频", icon: Upload },
              { id: "url", label: "视频链接", icon: Link2 },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
                  mode === m.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          {/* 上传区 */}
          {mode === "upload" ? (
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {file ? file.name : "点击选择 MP4 视频文件"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                支持 .mp4 / .mov / .webm · 视频将直传云端，由 AI 直接观看画面并转写语音
              </p>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="mt-5">
              <Input
                placeholder="https://www.example.com/video/xxxx"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  粘贴抖音、小红书、B站等平台的视频分享链接
                </p>
                <button
                  type="button"
                  onClick={() => setShowLinkHelp(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> 不知道怎么复制链接？
                </button>
              </div>
              {url.trim().length > 0 && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Tags className="h-4 w-4" /> 将提取参考信号（来自{" "}
                    {mockReferenceSignal(url, refType || undefined).platform}）
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    我们会读取该链接<b>公开</b>的标签 / 话题与高赞评论，作为 AI 分析的
                    <b>参考信号</b>——只参考、不当答案，也不会被当成结论。这些信号后续还会匿名反哺模型成长（见报告页「AI 成长飞轮」）。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mockReferenceSignal(url, refType || undefined).tags
                      .slice(0, 4)
                      .map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          #{t}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 可选标题 */}
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium">
              视频标题（选填）
            </label>
            <Input
              placeholder="不填则由 AI 推断"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 参考视频类型（演示模式由用户指定，让方向匹配判定确定可控） */}
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium">
              这条参考视频实际是什么类型？<span className="text-destructive">*</span>
            </label>
            <select
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="" disabled>
                请选择——用于判断分析方向；若未接通真实画面/语音理解，AI 会如实标注不确定性
              </option>
              {REFERENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              这一步决定「方向匹不匹配」判断准不准。比如你想做电影解说、却选了情感向，我们会直接告诉你俩不是一路，别硬抄。
            </p>
          </div>

          <Button
            onClick={start}
            disabled={!canStart || loading || quotaBlocked}
            variant="gradient"
            size="lg"
            className="mt-6 w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 正在分析…
              </>
            ) : (
              "开始分析"
            )}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-center text-xs text-destructive">
              {error}
            </p>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            当前免费公测：AI 会结合标题与类型生成拆解报告；上传 / 链接的真实视频理解（转写 + 画面识别）正在建设中。
          </p>
        </CardContent>
      </Card>

      {/* 流水线 */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">分析流程</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PIPELINE.map((p, i) => {
            const state =
              step > i ? "done" : step === i ? "active" : "idle";
            return (
              <div
                key={p.label}
                className={cn(
                  "flex flex-col items-center rounded-lg border p-3 text-center transition-all",
                  state === "active" && "border-primary bg-primary/5 shadow-sm",
                  state === "done" && "border-success/40 bg-success/5",
                  state === "idle" && "border-border bg-card"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    state === "active" && "bg-primary text-primary-foreground",
                    state === "done" && "bg-success/10 text-success",
                    state === "idle" && "bg-muted text-muted-foreground"
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-4 w-4" />
                  ) : state === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <p.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="mt-2 text-xs font-medium">{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <a
        href="/onboarding"
        className="mx-auto mt-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" /> 重新做新手摸底
      </a>

      {/* 怎么复制链接 · 帮助弹窗 */}
      </>)}
      <Dialog open={showLinkHelp} onOpenChange={setShowLinkHelp}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              怎么复制视频分享链接？
            </DialogTitle>
            <DialogDescription>
              不同平台的复制方法略有不同，按下面的步骤操作即可。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              {
                platform: "抖音",
                steps: [
                  "打开抖音 App，找到你想分析的视频",
                  "点击视频右侧「分享」按钮（箭头图标）",
                  "在弹出的分享面板中，向右滑动找到「复制链接」",
                  "粘贴到上方的输入框即可（链接格式类似 https://v.douyin.com/xxx）",
                ],
                note: "电脑端：打开抖音网页版 douyin.com，找到视频后点击「分享」→「复制链接」",
              },
              {
                platform: "小红书",
                steps: [
                  "打开小红书 App，进入你想分析的笔记/视频",
                  "点击右上角「分享」按钮",
                  "选择「复制链接」（不是「复制文案」）",
                  "粘贴到上方输入框（链接格式类似 http://xhslink.com/xxx）",
                ],
                note: "小红书的分享链接会自动跳转，我们只读取公开标签和评论信息。",
              },
              {
                platform: "B站",
                steps: [
                  "打开 B站 App 或网页，找到目标视频",
                  "点击视频下方的「分享」或「转发」按钮",
                  "选择「复制链接」或直接复制浏览器地址栏的 URL",
                  "粘贴到输入框（支持 bilibili.com 和 b23.tv 短链）",
                ],
                note: "B站链接通常以 bilibili.com/video/BV 开头。",
              },
              {
                platform: "微信视频号",
                steps: [
                  "打开微信 → 发现 → 视频号，找到目标视频",
                  "点击右上角「...」更多按钮",
                  "选择「复制链接」",
                  "粘贴到输入框即可",
                ],
                note: "视频号链接可能需要在微信内才能正常访问，我们读取其公开互动数据。",
              },
            ].map((p) => (
              <div key={p.platform} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold text-sm">
                  <Badge variant="outline">{p.platform}</Badge>
                </div>
                <ol className="space-y-1.5 text-sm text-foreground/85">
                  {p.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
                {p.note && (
                  <p className="mt-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-muted-foreground">
                    💡 {p.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center pt-2">
            我们只会读取该链接对应的<b>公开</b>标签、话题与评论数据作为参考信号，
            不会获取你的个人信息或登录状态。
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 免费配额用尽后的升级引导卡 */
function QuotaExhaustedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <Card className="mt-6 border-warning/30 bg-warning/5">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <Lock className="h-7 w-7" />
        </div>
        <div>
          <p className="text-lg font-semibold">今日免费分析已用完</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {BETA_OPEN
              ? "Beta 公测期间，核心创作能力免费开放，分析额度每天自动刷新，可明日继续体验。"
              : "免费版每天可分析 1 次（匿名按 IP 限次）。升级会员后无限次分析。"}
          </p>
        </div>
        <Button onClick={onUpgrade} variant="gradient" size="lg" className="gap-2">
          {BETA_OPEN ? <Sparkles className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          {BETA_OPEN ? "返回分析页" : "升级解锁无限次"}
        </Button>
        {!BETA_OPEN && (
          <p className="text-xs text-muted-foreground">
            会员功能：当前免费公测，升级流程为演示（不真实扣费）；正式收费前全站内容免费开放。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
