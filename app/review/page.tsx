"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Save, ListChecks, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth";
import { fetchWithRetry } from "@/lib/fetch-retry";

type ReviewItem = { id: string; title: string; createdAt: string; payload: any };
type ScriptItem = { id: string; title: string; hook: string };
type MetricKey = "plays" | "likes" | "comments" | "completionRate" | "follows" | "conversions";

// 从粘贴的后台数据/CSV 里识别关键指标（带中文标签），自动回填表单
const PASTE_KEYS: { k: MetricKey; re: RegExp }[] = [
  // 字段别名容忍：中文标签 + 常见英文/蛇形字段名都认，方便从不同平台后台直接复制
  { k: "plays", re: /(?:播放次数|播放量|播放|video_views|play_count|plays?|views)[^\d]*([\d.]+)/i },
  { k: "likes", re: /(?:点赞数|点赞|likes?|like_count)[^\d]*([\d.]+)/i },
  { k: "comments", re: /(?:评论数|评论|comments?|comment_count)[^\d]*([\d.]+)/i },
  { k: "completionRate", re: /(?:完播率|完播|completion_rate|complete_rate|completion)[^\d]*([\d.]+)/i },
  { k: "follows", re: /(?:涨粉数|涨粉|follows?|new_followers)[^\d]*([\d.]+)/i },
  { k: "conversions", re: /(?:转化|线索|conversions?|conversion|leads?)[^\d]*([\d.]+)/i },
];

export default function ReviewPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [scripts, setScripts] = React.useState<ScriptItem[]>([]);
  const [assetId, setAssetId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [metrics, setMetrics] = React.useState({ plays: "", likes: "", comments: "", completionRate: "", follows: "", conversions: "" });
  const [pasteText, setPasteText] = React.useState("");
  const [pasteMsg, setPasteMsg] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [result, setResult] = React.useState<any>(null);
  const [history, setHistory] = React.useState<ReviewItem[]>([]);
  const [learnings, setLearnings] = React.useState<string[]>([]);
  const [stage, setStage] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const STAGES = ["已提交，正在对齐你的账号人设…", "模型计算中，正在对照数据诊断…", "正在写回人设复盘…"];

  React.useEffect(() => {
    if (loading) return; // 等会话校准完，避免已登录用户被误判为未登录而踢回首页
    if (!session) { router.replace(`/login?redirect=${encodeURIComponent("/review")}`); return; }
    (async () => {
      try {
        const r = await fetch("/api/workspace?type=script&limit=100");
        if (r.ok) {
          const d = await r.json();
          setScripts((d.items || []).map((it: any) => ({ id: it.id, title: it.data?.title || "", hook: it.data?.hook || "" })));
        }
      } catch {}
      try {
        const r = await fetch("/api/review?limit=50");
        if (r.ok) setHistory((await r.json()).items || []);
      } catch {}
      try {
        const r = await fetch("/api/persona-card");
        const d = await r.json();
        setLearnings((d.card?.learnings || []).map((x: string) => x));
      } catch {}
    })();
  }, [session, loading, router]);

  const run = async () => {
    setErr("");
    const payload: any = {
      assetId: assetId || undefined,
      title: title || undefined,
      note: note || undefined,
      metrics: Object.fromEntries(Object.entries(metrics).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
    };
    setResult(null); setBusy(true); setStage(0);
    timerRef.current = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 2200);
    try {
      const r = await fetchWithRetry("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) {
        const err = new Error(d.error || "复盘失败") as Error & { status?: number };
        err.status = r.status;
        throw err;
      }
      setResult(d);
      // 刷新历史 + 人设复盘
      const r2 = await fetch("/api/review?limit=50");
      if (r2.ok) setHistory((await r2.json()).items || []);
      const r3 = await fetch("/api/persona-card");
      const d3 = await r3.json();
      setLearnings((d3.card?.learnings || []).map((x: string) => x));
    } catch (e: any) {
      const status = (e as any)?.status;
      setErr(status && status < 500 ? (e.message || "复盘失败") : "网络有点慢，已自动重试仍失败，请稍后再试");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setBusy(false); setStage(0);
    }
  };

  const num = (k: keyof typeof metrics) => (v: string) => setMetrics((m) => ({ ...m, [k]: v }));

  const parsePaste = () => {
    const txt = pasteText;
    const out: Partial<Record<MetricKey, string>> = {};
    for (const { k, re } of PASTE_KEYS) {
      const m = re.exec(txt);
      if (m) out[k] = m[1];
    }
    const found = Object.keys(out).length;
    if (found) {
      setMetrics((prev) => ({ ...prev, ...out }));
      setPasteMsg(`已自动填入 ${found} 项，请核对后提交`);
    } else {
      setPasteMsg("没识别到数字，试试格式：播放 3800，点赞 61，评论 40，完播率 7.2，涨粉 12，转化 2");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <Badge className="mb-3 gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> 第 5 环 · 数据复盘飞轮</Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">复盘实验室</h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          把发布后的真实数据回传，AI 结合你的定位和原脚本，告诉你这条为什么爆 / 没爆、下次该怎么改，
          并把结论写回你的账号定位档案——下次生成会更懂你。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold"><Save className="h-4 w-4 text-primary" /> 填报本次作品</p>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <label className="mb-1 block text-xs font-medium">粘贴后台数据，自动回填（可选）</label>
              <Textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteMsg(""); }} rows={2} placeholder="从抖音 / 小红书 / 视频号后台复制数据，粘贴到此处（支持 播放 / 点赞 / 评论 / 完播率 / 涨粉 / 转化）" />
              <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={parsePaste}>
                <Sparkles className="h-3.5 w-3.5" /> 自动填入
              </Button>
              {pasteMsg && <p className="mt-1 text-[11px] text-muted-foreground">{pasteMsg}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">关联作品 / 脚本（可选）</label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">不关联脚本，只给数据</option>
                {scripts.map((s) => (<option key={s.id} value={s.id}>{s.hook || s.title || "脚本"}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="mb-1 block text-xs text-muted-foreground">播放量</label><Input value={metrics.plays} onChange={(e) => num("plays")(e.target.value)} inputMode="numeric" placeholder="如：4200" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">点赞</label><Input value={metrics.likes} onChange={(e) => num("likes")(e.target.value)} inputMode="numeric" placeholder="如：95" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">评论</label><Input value={metrics.comments} onChange={(e) => num("comments")(e.target.value)} inputMode="numeric" placeholder="如：12" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">完播率 %</label><Input value={metrics.completionRate} onChange={(e) => num("completionRate")(e.target.value)} inputMode="decimal" placeholder="如：8.5" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">涨粉</label><Input value={metrics.follows} onChange={(e) => num("follows")(e.target.value)} inputMode="numeric" placeholder="如：30" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">转化 / 线索</label><Input value={metrics.conversions} onChange={(e) => num("conversions")(e.target.value)} inputMode="numeric" placeholder="如：3" /></div>
            </div>
            <div><label className="mb-1 block text-xs text-muted-foreground">作品标题 / 备注（可选）</label><Textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={1} placeholder="这条是讲深夜外卖实测的" /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">补充说明（可选）</label><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="比如：发了 2 小时没起量 / 评论区都在问链接" /></div>
            <Button onClick={run} disabled={busy || Object.values(metrics).every((v) => v === "") && !note && !assetId} className="w-full gap-1.5">
              <Sparkles className="h-4 w-4" />{busy ? "复盘诊断中…（约 15-30 秒）" : "🔍 开始复盘"}
            </Button>
            {busy && (
              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span aria-live="polite">{STAGES[stage]}</span>
                <span className="opacity-70">约 15-30 秒</span>
              </div>
            )}
            {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {result && (
            <Card className="border-primary/30">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />复盘结论</div>
                <Badge
                  variant={result.conclusion?.dataQuality === "platform" ? "success" : result.conclusion?.dataQuality === "estimated" ? "secondary" : "outline"}
                  className="mt-1 gap-1.5 text-[11px]"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {result.conclusion?.dataSourceLabel || (result.conclusion?.dataQuality === "none" ? "暂无拍后数据" : "数据依据")}
                </Badge>
                <p className="text-sm">{result.conclusion?.summary}</p>
                {result.conclusion?.diagnosis?.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {(result.conclusion.diagnosis as string[]).map((d, i) => <li key={i} className="flex gap-2"><span className="text-primary">·</span>{d}</li>)}
                  </ul>
                )}
                <p className="text-sm"><span className="font-semibold">为什么：</span>{result.conclusion?.why}</p>
                {result.conclusion?.nextSteps?.length > 0 && (
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">下次建议</p>
                    <ol className="mt-1 list-inside list-decimal space-y-1 text-sm">
                      {(result.conclusion.nextSteps as string[]).map((n, i) => <li key={i}>{n}</li>)}
                    </ol>
                  </div>
                )}
                <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted-foreground">✓ 已写入你的账号定位档案，下次策略生成会参考这条复盘。</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 font-semibold"><ListChecks className="h-4 w-4 text-primary" /> 账号定位档案 · 已有复盘</p>
              {learnings.length === 0
                ? <p className="mt-2 text-xs text-muted-foreground">还没有复盘沉淀。回传一次数据，飞轮就开始转了。</p>
                : <ul className="mt-2 space-y-2 text-sm">{learnings.map((l, i) => <li key={i} className="rounded-md border border-border/70 p-2">{l}</li>)}</ul>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-primary" /> 历史复盘</p>
              {history.length === 0
                ? <p className="mt-2 text-xs text-muted-foreground">暂无历史复盘。</p>
                : <ul className="mt-2 space-y-2">{history.map((h) => <li key={h.id} className="rounded-md border border-border/70 p-2 text-sm">
                    <span className="font-medium">{h.payload?.conclusion?.summary || h.title}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                  </li>)}</ul>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
