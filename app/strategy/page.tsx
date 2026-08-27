"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, RefreshCw, Music, AlertTriangle, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { fetchWithRetry } from "@/lib/fetch-retry";

export default function StrategyPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [persona, setPersona] = React.useState({ tags: "", resources: "", timing: "", platform: "抖音", audience: "" });
  const [reference, setReference] = React.useState("");
  const [product, setProduct] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [quotaUpgrade, setQuotaUpgrade] = React.useState(false);
  const [genStage, setGenStage] = React.useState(0);
  const genTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const GEN_STAGES = ["已提交，正在分析对标账号…", "模型计算中，正在构思原创脚本…", "正在拆分镜与音效…"];

  React.useEffect(() => {
    if (loading) return; // 等会话校准完再判断登录态，避免已登录用户被误判为未登录而踢回首页
    if (!session) { router.replace(`/login?redirect=${encodeURIComponent("/strategy")}`); return; }
    // 从账号诊所一键跳转过来：预填/覆盖整改方向（对标、产品方向、人设起点）
    const sp = new URLSearchParams(window.location.search);
    const diagRef = sp.get("diagReference");
    const diagProduct = sp.get("diagProduct");
    const diagPersona = sp.get("diagPersona");
    if (diagRef) setReference(diagRef);
    if (diagProduct) setProduct(diagProduct);
    if (diagPersona) setPersona((p) => ({ ...p, tags: diagPersona }));
    fetch("/api/persona-card").then((r) => r.json()).then((d) => {
      const c = d.card;
      if (c) setPersona((prev) => ({
        ...prev,
        tags: prev.tags || (c.personaTags || []).join("，"),   // diag 预填的 tags 优先，DB 只兜底
        resources: (c.resources || []).join("，") || prev.resources,
        timing: c.timing || prev.timing,
        platform: c.platform || prev.platform,
        audience: c.audience || prev.audience,
      }));
    }).catch(() => {});
  }, [session, loading, router]);

  const saveCard = async () => {
    setSaveMsg(""); setError("");
    const card = {
      personaTags: persona.tags.split(/[，,、]/).map((s) => s.trim()).filter(Boolean),
      resources: persona.resources.split(/[，,、]/).map((s) => s.trim()).filter(Boolean),
      timing: persona.timing, platform: persona.platform, audience: persona.audience,
    };
    try {
      const r = await fetch("/api/persona-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      setSaveMsg("✓ 账号定位已保存，下次生成会自动读取");
    } catch (e: any) { setError(e.message); }
  };

  const generate = async () => {
    setError(""); setResult(null); setQuotaUpgrade(false); setBusy(true);
    // 点了生成就把当前填写的账号定位落库（即使没手动点保存），让脚本真正贴合账号
    const hasFilled = persona.tags.trim() || persona.resources.trim() || persona.timing.trim() || persona.audience.trim();
    if (hasFilled) await saveCard();
    setGenStage(0);
    genTimerRef.current = setInterval(() => {
      setGenStage((s) => (s + 1) % GEN_STAGES.length);
    }, 2200);
    try {
      const r = await fetchWithRetry("/api/strategy-generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        reference, product, platform: persona.platform, duration: undefined,
      }) });
      const d = await r.json();
      if (!r.ok) {
        const err = new Error(d.error || "生成失败") as Error & { status?: number };
        err.status = r.status;
        (err as any).code = d.code;
        throw err;
      }
      setResult(d);
    } catch (e: any) {
      const status = (e as any)?.status;
      if (status === 429 || (e as any)?.code === "QUOTA_EXCEEDED") {
        setQuotaUpgrade(true);
        setError("今日免费额度已用完");
      } else {
        setError(status && status < 500 ? (e.message || "生成失败") : "网络有点慢，已自动重试仍失败，请稍后再试");
      }
    } finally {
      if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
      setBusy(false); setGenStage(0);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">爆款策略顾问</h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          先告诉我"你是谁、有什么、现在什么时机"，再用一个对标帮你算重合度，给你一条基于你优势的原创脚本（不是替换词）。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">我的账号定位</p>
              <Button variant="outline" size="sm" onClick={saveCard}><Save className="mr-1 h-3.5 w-3.5" />保存</Button>
            </div>
            <div className="space-y-2">
              <div><label className="mb-1 block text-xs text-muted-foreground">人设标签（用逗号分隔）</label><Input value={persona.tags} onChange={(e) => setPersona({ ...persona, tags: e.target.value })} placeholder="如：独居上班族 / 深夜美食 / 讲干货不露脸" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">现有资源</label><Input value={persona.resources} onChange={(e) => setPersona({ ...persona, resources: e.target.value })} placeholder="如：自有厨房实拍 / 样品供应链 / 能请嘉宾" /></div>
              <div><label className="mb-1 block text-xs text-muted-foreground">当前时机</label><Input value={persona.timing} onChange={(e) => setPersona({ ...persona, timing: e.target.value })} placeholder="如：年货节前 / 高考季 / 平台推流美食" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="mb-1 block text-xs text-muted-foreground">平台</label><Input value={persona.platform} onChange={(e) => setPersona({ ...persona, platform: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs text-muted-foreground">目标人群</label><Input value={persona.audience} onChange={(e) => setPersona({ ...persona, audience: e.target.value })} placeholder="如：25-35 岁上班族" /></div>
              </div>
            </div>
            {saveMsg && <p className="text-xs text-emerald-600 dark:text-emerald-300">{saveMsg}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold">生成我的策略脚本</p>
            <div><label className="mb-1 block text-xs text-muted-foreground">对标 / 参考内容（爆款标题、文案，或你选中的公式）</label><Textarea value={reference} onChange={(e) => setReference(e.target.value)} rows={3} placeholder="如：深夜零食铺：凌晨饿哭系列 9.9 三袋追剧零食" /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">我的产品 / 方向</label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="如：我卖的手工辣酱 / 我做美食探店" /></div>
            <Button onClick={generate} disabled={busy || (!reference && !product)} className="w-full gap-1.5"><Wand2 className="h-4 w-4" />{busy ? "策略生成中…（约 20-40 秒）" : "生成策略原创脚本"}</Button>
            {busy && (
              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span aria-live="polite">{GEN_STAGES[genStage]}</span>
                <span className="opacity-70">约 20-40 秒</span>
              </div>
            )}
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            {quotaUpgrade && !busy && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <p className="text-foreground/90">升级会员解锁更多策略生成、复盘与真实数据诊断。</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push("/pricing")}>查看升级方案</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <div className="mt-8 space-y-5">
          <Card className="border-primary/30">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />策略说明</div>
              <p className="text-sm text-foreground/90">{result.strategy_note}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-primary" />原创脚本</div>
              <p className="text-base font-semibold">{result.hook}</p>
              {(result.body || []).map((b: string, i: number) => <p key={i} className="text-sm">{i + 1}. {b}</p>)}
              <p className="text-sm text-primary">{result.cta}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4 text-primary" />分镜表（含音效/配乐）</div>
              <div className="space-y-2">
                {(result.shots || []).map((s: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-semibold">{i + 1}. {s.phase}（{s.durationSec}s）</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">画面：{s.visual}</p>
                    <p className="mt-0.5">{s.line}</p>
                    {s.sfx && <p className="mt-0.5 text-[10px] text-muted-foreground">音效：{s.sfx}</p>}
                    {s.bgm && <p className="mt-0.5 text-[10px] text-muted-foreground">配乐：{s.bgm}</p>}
                    {s.pitfall && <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{s.pitfall}</p>}
                  </div>
                ))}
                {result.soundDesign?.summary && (
                  <p className="rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs"><Music className="mr-1 inline h-3 w-3" /><span className="font-semibold">声音设计：</span>{result.soundDesign.summary}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
