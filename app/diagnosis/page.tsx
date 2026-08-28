"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, Upload, Camera, Loader2, Check, AlertTriangle, Target, Clapperboard, Wand2, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { fetchWithRetry } from "@/lib/fetch-retry";

const MAX_FILE_MB = 50;
const MAX_DURATION_MIN = 10;
const MAX_VIDEO_COUNT = 5;
/** 同时分析的视频数上限（避免一次烧太多 AI 成本 + 排队太久） */
const CONCURRENT_ANALYSIS = 2;

interface VideoItem {
  id: string;
  name: string;
  /** 当前阶段 */
  stage: "uploading" | "analyzing" | "done" | "error";
  /** 上传进度 0-100 */
  progress: number;
  /** 分析阶段文案（AI 在做什么），用于进度感 */
  phase?: string;
  report?: any;
  error?: string;
}

export default function DiagnosisPage() {
  const router = useRouter();
  const [videos, setVideos] = React.useState<VideoItem[]>([]);
  const [screenshots, setScreenshots] = React.useState<{ url: string }[]>([]);
  const [manual, setManual] = React.useState({ followers: "", engagementRate: "", avgPlays: "", avgLikes: "", avgComments: "", avgShares: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragCounter = React.useRef(0);
  // 诊断日志：记录上传/握手/分析每一步（fire-and-forget，绝不阻塞主流程）
  const sessionIdRef = React.useRef(`diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const diagLog = React.useCallback((e: { step: string; fileName?: string; fileSize?: number; detail?: string; ok?: boolean }) => {
    void fetch("/api/diagnosis/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current, ...e }),
    }).catch(() => {});
  }, []);

  async function analyzeOne(file: File, id: string, onUploadProgress?: (p: number) => void): Promise<VideoItem["report"]> {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`视频超过 ${MAX_FILE_MB}MB 限制`);
    }
    diagLog({ step: "video_start", fileName: file.name, fileSize: file.size });
    setVideos((v) => v.map((it) => (it.id === id ? { ...it, stage: "uploading", progress: 0 } : it)));
    // 上传到阿里云 OSS（前端 POST 表单直传，绕开 Vercel 4.5MB body 限制；千问内网直拉 OSS 不再超时）
    diagLog({ step: "oss_policy", fileName: file.name, fileSize: file.size });
    const sig = await fetchWithRetry(`/api/oss/policy?dir=videos`)
      .then((r) => r.json())
      .catch(() => ({}));
    diagLog({ step: "oss_policy_result", fileName: file.name, fileSize: file.size, ok: !!sig.host, detail: sig.host ? "ok" : "fail" });
    if (!sig.host) throw new Error("获取上传地址失败（OSS 未配置）");
    await putToOss(sig, file, onUploadProgress, (progress) => {
      diagLog({ step: "oss_upload_progress", fileName: file.name, fileSize: file.size, ok: true, detail: `${Math.round(progress)}%` });
    });
    const publicUrl = `${sig.host}/${sig.key}`;
    diagLog({ step: "oss_upload_done", fileName: file.name, fileSize: file.size, ok: true, detail: publicUrl });
    return doAnalyze({ videoUrl: publicUrl, title: file.name, refType: "auto", diag: true }, id, file);
  }

  /** 用 XHR 把文件 POST 表单直传到 OSS（能拿真实上传进度） */
  function putToOss(policy: any, file: File, onProgress?: (p: number) => void, onLog?: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("key", policy.key);
      fd.append("policy", policy.policy);
      fd.append("OSSAccessKeyId", policy.OSSAccessKeyId);
      fd.append("signature", policy.signature);
      fd.append("success_action_status", "200");
      fd.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", policy.host, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = (e.loaded / e.total) * 100;
          onProgress?.(p);
          onLog?.(p);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`上传失败（HTTP ${xhr.status}）`));
      };
      xhr.onerror = () => reject(new Error("上传网络错误，请检查网络"));
      xhr.onabort = () => reject(new Error("上传已取消"));
      xhr.ontimeout = () => reject(new Error("上传超时"));
      xhr.send(fd);
    });
  }

  /** 调用 /api/analyze/url 分析一个视频（小文件走 videoData/data URL，大文件走 videoUrl/blob URL），并推进阶段文案 */
  async function doAnalyze(body: any, id: string, file: File): Promise<VideoItem["report"]> {
    setVideos((v) => v.map((it) => (it.id === id ? { ...it, stage: "analyzing", progress: 100, phase: "① 读取视频画面…（约30~120秒）" } : it)));
    diagLog({ step: "analyze_start", fileName: file.name, fileSize: file.size });
    const phases = ["① 读取视频画面…", "② 转写语音…", "③ 生成结构化分析…"];
    let pi = 0;
    const phaseTimer = setInterval(() => {
      pi = Math.min(pi + 1, phases.length - 1);
      setVideos((v) => v.map((it) => (it.id === id ? { ...it, phase: phases[pi] } : it)));
    }, 20000);
    try {
      const res = await fetchWithRetry("/api/analyze/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "视频分析失败");
      clearInterval(phaseTimer);
      diagLog({ step: "analyze_done", fileName: file.name, fileSize: file.size, ok: true });
      return data;
    } catch (e: any) {
      clearInterval(phaseTimer);
      diagLog({ step: "analyze_error", fileName: file.name, fileSize: file.size, ok: false, detail: e?.message || "分析异常" });
      throw e;
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("video/"));
    const currentCount = videos.length;
    const room = MAX_VIDEO_COUNT - currentCount;
    if (room <= 0) {
      setError(`最多上传 ${MAX_VIDEO_COUNT} 个视频，你已达上限，请先移除后再传`);
      return;
    }
    const accepted = list.slice(0, room);
    setError(list.length > room ? `最多 ${MAX_VIDEO_COUNT} 个视频，已保留前 ${room} 个` : null);
    // 为每个文件创建一个自增 id，先 push 列表，再启动处理
    const items: { f: File; id: string }[] = [];
    for (const f of accepted) {
      const id = `${f.name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      diagLog({ step: "video_add", fileName: f.name, fileSize: f.size });
      items.push({ f, id });
      setVideos((v) => [...v, { id, name: f.name, stage: "uploading", progress: 0 }]);
    }
    // 并发分析：同一时刻最多 CONCURRENT_ANALYSIS 个进入"分析中"，避免一次烧太多
    await runWithConcurrency(items, processOne, CONCURRENT_ANALYSIS);
  }

  /** 处理单个视频：上传（带进度）→ 分析（限并发）→ 更新状态 */
  async function processOne(file: File, id: string) {
    try {
      const report = await analyzeOne(file, id, (p) => {
        setVideos((v) => v.map((it) => (it.id === id ? { ...it, progress: p } : it)));
      });
      setVideos((v) => v.map((it) => (it.id === id ? { ...it, stage: "done", progress: 100, report } : it)));
    } catch (e: any) {
      setVideos((v) => v.map((it) => (it.id === id ? { ...it, stage: "error", error: e?.message || "失败" } : it)));
      diagLog({ step: "process_error", fileName: file.name, fileSize: file.size, ok: false, detail: e?.message || "失败" });
    }
  }

  /** 并发池：同一时刻最多 limit 个任务在跑，其余排队 */
  async function runWithConcurrency(
    items: { f: File; id: string }[],
    worker: (f: File, id: string) => Promise<void>,
    limit: number
  ) {
    let cursor = 0;
    async function run() {
      while (cursor < items.length) {
        const it = items[cursor++];
        await worker(it.f, it.id);
      }
    }
    const n = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: n }, () => run()));
  }

  async function uploadScreenshot(file: File) {
    setError(null);
    diagLog({ step: "screenshot_start", fileName: file.name, fileSize: file.size });
    try {
      const sig = await fetchWithRetry(`/api/oss/policy?dir=images`)
        .then((r) => r.json())
        .catch(() => ({}));
      if (!sig.host) throw new Error("截图上传配置失败（OSS 未配置）");
      await putToOss(sig, file);
      const url = `${sig.host}/${sig.key}`;
      diagLog({ step: "screenshot_oss_done", fileName: file.name, fileSize: file.size, ok: true, detail: url });
      setScreenshots((s) => [...s, { url }]);
      // 尝试从截图识别数据回填
      const pr = await fetchWithRetry("/api/screenshot-parse", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, platform: "douyin" }),
      }).then((r) => r.json().catch(() => ({})));
      if (pr.ok && pr.data) {
        const d = pr.data;
        setManual((m) => ({
          ...m,
          followers: d.followers != null ? String(d.followers) : m.followers,
          engagementRate: d.engagementRate != null ? String(d.engagementRate) : m.engagementRate,
          avgPlays: d.avgPlays != null ? String(d.avgPlays) : m.avgPlays,
          avgLikes: d.avgLikes != null ? String(d.avgLikes) : m.avgLikes,
          avgComments: d.avgComments != null ? String(d.avgComments) : m.avgComments,
          avgShares: d.avgShares != null ? String(d.avgShares) : m.avgShares,
        }));
      }
    } catch (e: any) {
      setError(e?.message || "截图上传失败");
      diagLog({ step: "screenshot_error", fileName: file.name, fileSize: file.size, ok: false, detail: e?.message || "失败" });
    }
  }

  async function runDiagnosis() {
    const reports = videos.filter((v) => v.stage === "done" && v.report).map((v) => v.report);
    if (reports.length === 0) {
      setError("请先上传至少 1 个视频");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/diagnosis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reports,
          followers: manual.followers.trim() ? Number(manual.followers) : undefined,
          engagementRate: manual.engagementRate.trim() ? Number(manual.engagementRate) : undefined,
          avgPlays: manual.avgPlays.trim() ? Number(manual.avgPlays) : undefined,
          avgLikes: manual.avgLikes.trim() ? Number(manual.avgLikes) : undefined,
          avgComments: manual.avgComments.trim() ? Number(manual.avgComments) : undefined,
          avgShares: manual.avgShares.trim() ? Number(manual.avgShares) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "诊断失败");
        return;
      }
      setResult(data.result);
    } catch (e: any) {
      setError(e?.message || "诊断失败");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> 账号证据诊断</Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI 账号诊断（证据驱动）</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          上传你的视频 + 后台数据截图，我会真实分析你的内容质量、钩子与结构，再给出可执行的改进意见。每个结论都有证据。
        </p>
      </div>

      {/* 第一步：上传视频 */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
            <Clapperboard className="h-4 w-4 text-primary" /> 上传视频（最多 {MAX_VIDEO_COUNT} 个，越多越准）
          </div>
          <div
            className={`rounded-lg border border-dashed p-5 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border/80"}`}
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current += 1; setDragging(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); dragCounter.current -= 1; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
            onDrop={(e) => { e.preventDefault(); dragCounter.current = 0; setDragging(false); onFiles(e.dataTransfer.files); }}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">拖拽视频到这里，或点击选择</p>
            <p className="mt-1 text-xs text-muted-foreground">单个 ≤ {MAX_FILE_MB}MB、时长 ≤ {MAX_DURATION_MIN} 分钟、最多 {MAX_VIDEO_COUNT} 个</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/30">
              <Upload className="h-4 w-4" /> 上传视频
              <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {videos.length > 0 && (
            <ul className="space-y-2">
              {videos.map((v, i) => (
                <li key={i} className="rounded-md border border-border/70 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {v.stage === "done" ? <Check className="h-4 w-4 shrink-0 text-success" /> : v.stage === "error" ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                    <span className="flex-1 truncate">{v.name}</span>
                    <Badge variant={v.stage === "done" ? "success" : v.stage === "error" ? "warning" : "secondary"}>
                      {v.stage === "uploading" ? `上传中 ${v.progress}%` : v.stage === "analyzing" ? "AI 分析中…" : v.stage === "done" ? (v.report?.visual?.mode === "real" ? "已真实分析" : "分析完成(演示)") : "失败"}
                    </Badge>
                  </div>
                  {(v.stage === "uploading" || v.stage === "analyzing") && (
                    <Progress
                      value={v.stage === "analyzing" ? 100 : Math.max(1, v.progress)}
                      className="mt-2 h-1.5"
                      indicatorClassName={v.stage === "analyzing" ? "animate-pulse bg-primary" : "bg-primary"}
                    />
                  )}
                  {v.stage === "analyzing" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {v.phase || "正在让 AI 分析视频（约 30~90 秒）…"}
                    </p>
                  )}
                  {v.error && <span className="text-xs text-destructive">{v.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 第二步：后台数据（截图或手填） */}
      <Card className="mt-4">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
            <Camera className="h-4 w-4 text-primary" /> 账号后台数据（截图或手填，让诊断更准）
          </div>
          {screenshots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {screenshots.map((s, i) => <img key={i} src={s.url} alt="截图" className="h-16 w-16 rounded-md object-cover" />)}
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" /> 上传后台截图（粉丝/数据页）
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); e.target.value = ""; }} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["followers", "粉丝量·万"], ["engagementRate", "互动率·%"], ["avgPlays", "平均播放"],
              ["avgLikes", "平均点赞"], ["avgComments", "平均评论"], ["avgShares", "平均转发"],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="mb-1 block text-xs font-medium">{label}</label>
                <Input value={manual[k as keyof typeof manual]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} placeholder="如：12 / 3.2" inputMode="decimal" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <Button onClick={runDiagnosis} disabled={busy} variant="gradient" className="mt-5 w-full gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "诊断中…" : "开始针对性诊断"}
      </Button>

      {result && !busy && <DiagnosisResult r={result} />}
    </div>
  );
}

function DiagnosisResult({ r }: { r: any }) {
  return (
    <div className="mt-6 space-y-5">
      <Card className="border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">账号健康度</p>
              <p className="mt-1 text-3xl font-bold">{r.overallScore}<span className="text-lg font-normal text-muted-foreground">/100</span></p>
            </div>
            <div className="max-w-md text-right"><p className="text-sm">{r.summary}</p></div>
          </div>
          <Progress value={r.overallScore} className="mt-4" />
          <p className="mt-2 text-[11px] text-muted-foreground">基于 {r.availableCount}/{r.totalVideos} 个视频的真实分析（{r.evidenceSufficient ? "证据充分" : "证据不足，仅供参考"}）</p>
          {!r.evidenceSufficient && <p className="mt-1.5 rounded-md border border-warning/30 bg-warning/5 px-3 py-1.5 text-[11px] text-muted-foreground">当前视频尚未被视觉模型真实分析（演示模式），内容类诊断是估算。生产环境配置后重新上传即可得到真实诊断。</p>}
        </CardContent>
      </Card>

      {/* 维度分 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-primary" /> 分维度</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(r.metrics || []).filter((m: any) => m.value != null).map((m: any, i: number) => (
            <Card key={i}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{m.label}</p><p className="mt-1 text-xl font-bold">{m.value}{m.value != null ? <span className="text-xs text-muted-foreground">/100</span> : ""}</p><p className="mt-1 text-[11px] text-muted-foreground">{m.note}</p></CardContent></Card>
          ))}
        </div>
      </div>

      {/* 针对性诊断 + 改进建议 */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Target className="h-5 w-5 text-primary" /> 针对性诊断与改进建议</h2>
        <div className="space-y-3">
          {(r.diagnoses || []).map((d: any, i: number) => (
            <Card key={i} className={d.severity === "high" ? "border-red-500/30" : "border-border/70"}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={d.severity === "high" ? "warning" : d.severity === "medium" ? "warning" : "secondary"}>{d.severity === "high" ? "优先" : d.severity === "medium" ? "关注" : "提示"}</Badge>
                  <p className="text-sm font-semibold">{d.title}</p>
                </div>
                <p className="text-sm text-muted-foreground">{d.detail}</p>
                {d.evidence?.length > 0 && (
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                    <p className="font-medium">证据：</p>
                    {d.evidence.map((e: any, j: number) => <p key={j}>· {e.type}：{e.detail}</p>)}
                  </div>
                )}
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">怎么增强 / 加钩子</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {d.howToImprove.map((h: string, j: number) => <li key={j} className="flex gap-1.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{h}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
