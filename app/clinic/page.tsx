"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Sparkles,
  Target,
  Check,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ListChecks,
  Wand2,
  ShieldAlert,
  Camera,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useSession } from "@/lib/auth";

// 赛道做广覆盖：在原有 11 个基础上扩展，覆盖更多细分领域
const NICHES = [
  "生活", "旅游", "美食", "情感", "知识", "美妆护肤", "穿搭", "母婴",
  "剧情", "搞笑", "商业", "运动健身", "宠物", "家居", "教育", "职场",
  "财经", "汽车", "数码", "游戏", "摄影", "手工", "舞蹈", "音乐",
  "健康养生", "法律", "房产", "三农", "国潮", "动画",
];
const TYPES: { id: "sell" | "talk"; label: string }[] = [
  { id: "sell", label: "卖货 / 带货" },
  { id: "talk", label: "口播 / 知识" },
];
const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "快手", "TikTok", "其他"];

export default function ClinicPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [form, setForm] = React.useState({
    niche: "生活",
    contentType: "talk" as "sell" | "talk",
    platform: "抖音",
    account: "",
    followers: "",
    engagementRate: "",
    description: "",
    avgPlays: "",
    avgLikes: "",
    avgComments: "",
    avgShares: "",
    sampleText: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [parseHint, setParseHint] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [screenshots, setScreenshots] = React.useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const authReady = !sessionLoading; // useSession 校准完再用，避免未登录闪烁

  // 账号名/链接一填，就自动请求预览，帮用户确认「是不是自己的账号」（避免重名）
  const accountTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (accountTimer.current) clearTimeout(accountTimer.current);
    const account = form.account.trim();
    if (!account) {
      setPreview(null);
      return;
    }
    accountTimer.current = setTimeout(() => {
      setPreviewing(true);
      fetch("/api/account-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: form.platform,
          account,
          followers: form.followers.trim() ? Number(form.followers) : undefined,
          engagementRate: form.engagementRate.trim() ? Number(form.engagementRate) : undefined,
          avgPlays: form.avgPlays.trim() ? Number(form.avgPlays) : undefined,
          avgLikes: form.avgLikes.trim() ? Number(form.avgLikes) : undefined,
          avgComments: form.avgComments.trim() ? Number(form.avgComments) : undefined,
          sampleText: form.sampleText,
        }),
      })
        .then((r) => r.json())
        .then((d) => setPreview(d?.preview ?? null))
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false));
    }, 450);
    return () => {
      if (accountTimer.current) clearTimeout(accountTimer.current);
    };
  }, [form.account, form.platform, form.followers, form.engagementRate, form.avgPlays, form.avgLikes, form.avgComments, form.sampleText]);

  async function run() {
    // 登录守卫：未登录则弹窗，不强行跳首页，登录成功后回到本页继续
    if (!authReady) return;
    if (!session) {
      setLoginOpen(true);
      return;
    }
    const hasData =
      form.account.trim() || form.followers.trim() || form.engagementRate.trim() ||
      form.avgPlays.trim() || form.avgLikes.trim() || form.avgComments.trim() ||
      form.avgShares.trim() || form.description.trim() || form.sampleText.trim();
    if (!hasData) {
      setError("请先填账号名 / 主页链接，或至少一项账号数据（粉丝量/互动率等），否则无法做诊断");
      setResult(null);
      return;
    }
    const numericFields: [string, string][] = [
      ["粉丝量", form.followers],
      ["互动率", form.engagementRate],
      ["平均播放", form.avgPlays],
      ["平均点赞", form.avgLikes],
      ["平均评论", form.avgComments],
      ["平均转发", form.avgShares],
    ];
    for (const [label, v] of numericFields) {
      if (v.trim() && !/^\d+(\.\d+)?$/.test(v.trim())) {
        setError(`${label}需填数字（如 3.2），当前填了「${v.trim()}」`);
        setResult(null);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: form.niche,
          contentType: form.contentType,
          platform: form.platform.trim() || undefined,
          account: form.account.trim() || undefined,
          followers: form.followers.trim() ? Number(form.followers) : undefined,
          engagementRate: form.engagementRate.trim() ? Number(form.engagementRate) : undefined,
          avgPlays: form.avgPlays.trim() ? Number(form.avgPlays) : undefined,
          avgLikes: form.avgLikes.trim() ? Number(form.avgLikes) : undefined,
          avgComments: form.avgComments.trim() ? Number(form.avgComments) : undefined,
          avgShares: form.avgShares.trim() ? Number(form.avgShares) : undefined,
          description: form.description.trim() || undefined,
          sampleText: form.sampleText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 登录态失效：引导登录，不中断本次诊断流程
        if (res.status === 401 || data.code === "UN_AUTHED") {
          setLoginOpen(true);
          setError("为了您的体验，请先登录，登录后自动继续诊断");
          return;
        }
        setError(data.error || "诊断失败，请稍后重试");
        return;
      }
      setResult(data);
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  // 截图上传：把手机/拍图传上来作为补充信息，比手填省事、信息更多
  async function uploadScreenshot(file: File) {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const ticketRes = await fetch("/api/screenshot-upload-url", { method: "POST" });
      const ticket = await ticketRes.json().catch(() => ({ blobMode: false }));
      let url: string;
      if (ticket.blobMode) {
        const { upload: blobUpload } = await import("@vercel/blob/client");
        const blob = await blobUpload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
          contentType: file.type || "image/png",
          abortSignal: AbortSignal.timeout(180_000),
        });
        url = blob.url;
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/screenshot-upload", { method: "POST", body: fd });
        const d = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(d.error || "上传失败");
        url = d.url;
      }
      setScreenshots((s) => [...s, { url, name: file.name }]);
      // 上传成功后自动识别截图数据，回填到表单（需登录，涉及 AI 成本）
      if (session) {
        try {
          const pr = await fetchWithRetry("/api/screenshot-parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, platform: form.platform }),
          });
          const pd = await pr.json().catch(() => ({}));
          if (pd.ok && pd.data) {
            const d = pd.data;
            setForm((f) => ({
              ...f,
              followers: d.followers != null ? String(d.followers) : f.followers,
              engagementRate: d.engagementRate != null ? String(d.engagementRate) : f.engagementRate,
              avgPlays: d.avgPlays != null ? String(d.avgPlays) : f.avgPlays,
              avgLikes: d.avgLikes != null ? String(d.avgLikes) : f.avgLikes,
              avgComments: d.avgComments != null ? String(d.avgComments) : f.avgComments,
              avgShares: d.avgShares != null ? String(d.avgShares) : f.avgShares,
            }));
            if (pd.note) setParseHint(pd.note);
          } else if (pd.error) {
            // 解析失败不覆盖用户手动填写，仅提示
            setParseHint(pd.error);
          }
        } catch {
          /* 截图识别失败不阻断上传 */
        }
      }
    } catch (e: any) {
      setError(e?.message || "截图上传失败，请稍后重试");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5">
          <Stethoscope className="h-3.5 w-3.5" /> 公测期全站免费
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">账号诊所</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          填平台 + 账号，AI 会先帮你确认「是不是自己的账号」，再和同赛道最值得抄的「黑马对标」对比诊断。
        </p>
      </div>

      {!result ? (
        <Card>
          <CardContent className="space-y-5 p-6">
            {/* 第一步：平台 */}
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span>
              你在哪个平台发布
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setForm({ ...form, platform: pt })}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    form.platform === pt ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>

            {/* 第二步：账号名称 / 主页链接 */}
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span>
              你的账号名称 / 主页链接
            </div>
            <Input
              value={form.account}
              onChange={(e) => setForm({ ...form, account: e.target.value })}
              placeholder="如：@我的美食账号 或 主页链接（粘贴后自动识别）"
            />
            {previewing && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在识别账号…
              </p>
            )}
            {preview && !previewing && (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <UserCheck className="h-4 w-4 text-primary" />
                  账号识别结果
                  {preview.recognized ? (
                    <Badge variant="success" className="text-[10px]">已识别</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">未识别</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.platform} · {preview.account}
                  {preview.hasAccountKey && preview.accountKey && (
                    <span className="text-muted-foreground/70">（账号标识：{preview.accountKey.slice(0, 16)}…）</span>
                  )}
                </p>
                {preview.hasSignals && preview.signals?.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.signals.map((s: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[11px]">
                        {s.label}：{s.value}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{preview.note}</p>
                )}
                {preview.hasAccountKey && !preview.hasSignals && (
                  <p className="mt-2 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    仅凭账号无法做针对性数据诊断。请补一项真实数据（粉丝/播放等），或上传账号数据截图，AI 会自动读取并回填。
                  </p>
                )}
              </div>
            )}

            {/* 第三步：赛道（可不选，默认即可） */}
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">3</span>
              赛道（不选也能诊断，选更准）
            </div>
            <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {NICHES.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            <div>
              <label className="mb-1 block text-xs font-medium">内容类型</label>
              <div className="flex gap-2" role="group" aria-label="内容类型">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" aria-pressed={form.contentType === t.id} onClick={() => setForm({ ...form, contentType: t.id })} className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${form.contentType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 补充信息（保留，且新增截图上传） */}
            <details className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                补充账号数据（可选，让诊断更稳、更准。这里填的你手头数据，或直接传截图）
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium">粉丝量·万</label><Input value={form.followers} onChange={(e) => setForm({ ...form, followers: e.target.value })} placeholder="如：12" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">互动率·%</label><Input value={form.engagementRate} onChange={(e) => setForm({ ...form, engagementRate: e.target.value })} placeholder="如：3.2" inputMode="decimal" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium">平均播放</label><Input value={form.avgPlays} onChange={(e) => setForm({ ...form, avgPlays: e.target.value })} placeholder="如：4200" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">平均转发</label><Input value={form.avgShares} onChange={(e) => setForm({ ...form, avgShares: e.target.value })} placeholder="如：36" inputMode="numeric" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs font-medium">平均点赞</label><Input value={form.avgLikes} onChange={(e) => setForm({ ...form, avgLikes: e.target.value })} placeholder="如：95" inputMode="numeric" /></div>
                  <div><label className="mb-1 block text-xs font-medium">平均评论</label><Input value={form.avgComments} onChange={(e) => setForm({ ...form, avgComments: e.target.value })} placeholder="如：12" inputMode="numeric" /></div>
                </div>
                <div><label className="mb-1 block text-xs font-medium">账号近况</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="做了 2 个月美食号，基本没人看…" rows={2} /></div>
                <div><label className="mb-1 block text-xs font-medium">文案采样</label><Textarea value={form.sampleText} onChange={(e) => setForm({ ...form, sampleText: e.target.value })} placeholder="粘贴你最近一条视频的口播文案…" rows={2} /></div>

                {/* 截图上传 */}
                <div className="rounded-lg border border-dashed border-border/80 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Camera className="h-4 w-4 text-primary" /> 截图/图片上传（可多张，如账号主页、数据截图）
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {screenshots.map((s, i) => (
                      <img key={i} src={s.url} alt={s.name} className="h-16 w-16 rounded-md object-cover" />
                    ))}
                  </div>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-foreground/30">
                    <Camera className="h-3.5 w-3.5" /> {uploading ? "上传中…" : "上传截图"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadScreenshot(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    上传后系统会自动识别截图里的粉丝/播放等并回填到上面（需登录）。截图数据比手动填更省事、也更贴近真实。
                  </p>
                  <input type="hidden" value={screenshots.map((s) => s.url).join(",")} />
                </div>
              </div>
            </details>

            {error && (<p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>)}
            {parseHint && !error && (
              <p className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">{parseHint}</p>
            )}

            <Button onClick={run} disabled={loading} className="w-full gap-1.5">
              <Sparkles className="h-4 w-4" />
              {loading ? "深度诊断中…" : "🔍 开始深度诊断"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {session ? "登录已生效，会为你保存诊断记录。" : "未登录也能填，但诊断需先登录，登录后回到这里继续。"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ClinicResult r={result} form={form} onReset={() => setResult(null)} />
      )}

      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          // 登录成功后回到本页继续（不跳首页），数据仍在表单中
          setError(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ClinicResult({ r, form, onReset }: { r: any; form: any; onReset: () => void }) {
  const router = useRouter();
  // 缺数据：不让用户看到"空谈模板"，改为明确的补数据引导
  if (r.needsData) {
    return (
      <Card className="border-warning/40">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">还差一点数据，诊断才能有针对性</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              你填了账号，但缺少能支撑判断的真实数据。没有数据我不会凭空编一份报告——那样对你没价值。
            </p>
          </div>
          <ul className="mx-auto max-w-md space-y-2 text-left text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> 上传你的视频（3~10个），系统真实分析内容质量、钩子、结构</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> 或上传账号后台数据截图（主页/数据页），AI 自动读取回填</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> 系统从视频+数据里提取证据，给出有据可查的针对性诊断</li>
          </ul>
          <Button asChild variant="gradient" className="gap-1.5">
            <Link href="/diagnosis">
            <Wand2 className="h-4 w-4" /> 去补充数据 / 上传截图
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const goFix = () => {
    const q = new URLSearchParams({
      diagReference: (r.benchmarks?.[0]?.name || "") || "",
      diagProduct: (form?.description?.trim() || form?.niche || ""),
      diagPersona: (form?.niche || ""),
    }).toString();
    router.push(`/strategy?${q}`);
  };
  return (
    <div className="space-y-6">
      {/* 健康度 */}
      <Card className="border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">账号健康度</p>
              <p className="mt-1 text-3xl font-bold">
                {r.score}
                <span className="text-lg font-normal text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="max-w-md text-right">
              <p className="text-sm">{r.summary}</p>
            </div>
          </div>
          <Progress value={r.score} className="mt-4" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant={r.dataQuality === "platform" ? "success" : r.dataQuality === "estimated" ? "secondary" : "outline"}
              className="gap-1.5 text-[11px]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              {r.dataSourceLabel || (r.dataQuality === "none" ? "暂无账号数据" : "数据依据")}
            </Badge>
            {r.sourceNote && (
              <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-1.5 text-[11px] text-muted-foreground">
                {r.sourceNote}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 数据真实性 / 疑似刷量检测 */}
      {r.organic && (
        <Card className="border-amber-500/30">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-amber-500" /> 数据真实性检测
              <Badge variant={r.organic.score >= 90 ? "success" : r.organic.score >= 70 ? "secondary" : "warning"} className="text-[11px]">
                健康 {r.organic.score}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.organic.note}</p>
            {(r.organic.signals || []).filter((s: any) => s.level !== "low").map((s: any, i: number) => (
              <div key={i} className={`rounded-lg border p-3 ${s.redFlag ? "border-destructive/40 bg-destructive/5" : ""}`}>
                <p className="text-xs font-medium">{s.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 去生成整改脚本 */}
      <Button onClick={goFix} variant="gradient" className="w-full gap-1.5">
        <Wand2 className="h-4 w-4" /> 用这份诊断去生成整改脚本
        <ArrowRight className="h-4 w-4" />
      </Button>

      {/* 全局战略观 */}
      {(r.redOcean || r.homogen || r.differentiation) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> 全局战略观
          </h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium">赛道红海度</p>
                  <Badge className="mt-1 bg-primary/15 text-primary text-[10px]">{r.redOcean?.level}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{r.redOcean?.detail}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-300">同质化预警</p>
                  <p className="mt-1 text-sm">{r.homogen?.alert}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.homogen?.consequence}</p>
                </div>
              </div>
              {(r.differentiation || []).length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">差异化破局出路</p>
                  {(r.differentiation as string[]).map((d, i) => (
                    <p key={i} className="mt-1 flex gap-1.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {d}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 微观执行诊断 */}
      {(r.topics || r.hookDiag || r.schedule) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> 微观执行诊断
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-muted-foreground">选题与热点</p>
                <p className="text-sm">{r.topics}</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-red-500/80">黄金 3 秒钩子</p>
                <p className="text-sm">{r.hookDiag}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium text-muted-foreground">更新频率与时段</p>
                <p className="text-sm">{r.schedule}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 下周行动清单 */}
      {(r.todoList || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="h-5 w-5 text-primary" /> 下周改版行动清单
          </h2>
          <Card>
            <CardContent className="space-y-2.5 p-5">
              {(r.todoList as string[]).map((a, i) => (
                <p key={i} className="flex gap-2 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                  <span>{a}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 维度对比 */}
      {(r.dimensions || []).length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Target className="h-5 w-5 text-primary" /> 关键维度对比
          </h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              {(r.dimensions as any[]).map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.advice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">你的：{d.yourValue}</p>
                    <p className="text-xs text-muted-foreground">对标：{d.benchValue}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Button onClick={onReset} variant="outline" className="w-full">
        返回重新诊断
      </Button>
    </div>
  );
}
