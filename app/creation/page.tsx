"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles } from "lucide-react";
import { fetchWithRetry } from "@/lib/fetch-retry";

export default function CreationPage() {
  const [f, setF] = React.useState({ domain: "", product: "", goal: "", benchmark: "", style: "", requirement: "" });
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<any>(null);

  // 从 URL query 预填（从首页"生成我的原创策略脚本"跳转进来）
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const upd: any = {};
    if (sp.get("domain")) upd.domain = sp.get("domain");
    if (sp.get("product")) upd.product = sp.get("product");
    if (sp.get("style")) upd.style = sp.get("style");
    if (sp.get("requirement")) upd.requirement = sp.get("requirement");
    if (Object.keys(upd).length) setF((p) => ({ ...p, ...upd }));
  }, []);

  async function go() {
    if (!f.domain.trim() || !f.product.trim()) { setErr("请至少填「赛道」和「产品」"); return; }
    setLoading(true); setErr(null);
    try {
      const r = await fetchWithRetry("/api/creation/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "生成失败");
      setRes(d);
    } catch (e: any) { setErr(e?.message || "生成失败"); } finally { setLoading(false); }
  }

  const field = (k: keyof typeof f, label: string, ph: string) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} />
    </div>
  );

  const Storyboard = ({ sb }: { sb: any[] }) => (
    <div className="space-y-2">
      {(sb || []).map((s: any, i: number) => (
        <div key={i} className="rounded-md border border-border/70 bg-muted/20 p-2.5 text-sm">
          <p className="text-xs font-medium text-muted-foreground">镜头 {s.i ?? i + 1} · {s.sec ?? ""}s</p>
          <p><span className="text-muted-foreground text-xs">画面：</span>{s.shot}</p>
          <p><span className="text-muted-foreground text-xs">字幕：</span>{s.caption}</p>
          <p><span className="text-muted-foreground text-xs">旁白：</span>{s.voice}</p>
          <p><span className="text-muted-foreground text-xs">BGM：</span>{s.bgm}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">创作工坊</h1>
      <p className="mb-5 text-sm text-muted-foreground">告诉我们要做什么，共创 brief → 产品级文稿+分镜 → 4 角色审稿 → 修订到能拍。</p>

      <Card className="mb-5">
        <CardHeader><CardTitle>1 · 你的需求</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {field("domain", "短视频赛道", "如：职场干货 / 美妆 / 家居好物")}
          {field("product", "具体产品", "如：一款提神咖啡 / 家用除螨仪")}
          {field("goal", "想达到的目的", "如：涨粉 / 带货转化 / 品牌曝光")}
          {field("benchmark", "对标账号（可选）", "如：XX涨粉快的口播号")}
          {field("style", "你的风格喜好", "如：幽默 / 专业 / 治愈 / 毒舌")}
          {field("requirement", "特殊要求", "如：要真实不做作 / 前3秒必须出钩子")}
          <div className="sm:col-span-2">
            <Button onClick={go} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在共创+写稿+审稿…（约 1-2 分钟）</> : <><Sparkles className="mr-2 h-4 w-4" /> 生成产品级文稿 + 分镜</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {err && <p className="mb-4 text-sm text-red-500">{err}</p>}

      {res && (
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>② 创作 brief（共创确认）</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{res.brief}</p></CardContent></Card>

          <Card><CardHeader><CardTitle>③ 原创稿（可拿去拍）</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {res.draft?.hooks && <Badge variant="secondary">钩子：{res.draft.hooks}</Badge>}
                {res.draft?.cta && <Badge variant="secondary">CTA：{res.draft.cta}</Badge>}
                {(res.draft?.tags || []).map((t: string, i: number) => <Badge key={i} variant="outline">{t}</Badge>)}
              </div>
              <div className="rounded-md border border-border/70 bg-muted/10 p-3 text-sm leading-relaxed whitespace-pre-wrap">{res.draft?.script}</div>
              {res.draft?.storyboard && <Storyboard sb={res.draft.storyboard} />}
            </CardContent></Card>

          <Card><CardHeader><CardTitle>④ 4 角色审稿</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {(res.reviews || []).map((rv: any, i: number) => (
                <div key={i} className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center gap-2"><Badge variant="secondary">{rv.role}</Badge>
                    <Badge variant={rv.review?.verdict === "通过" ? "success" : "warning"}>{rv.review?.verdict || "需改"} {rv.review?.score != null ? `· ${rv.review.score}` : ""}</Badge></div>
                  {(rv.review?.strengths || []).map((s: string, j: number) => <p key={j} className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">· {s}</p>)}
                  <p className="mt-1 text-xs text-muted-foreground">{typeof rv.review === "string" ? rv.review : JSON.stringify(rv.review)}</p>
                </div>
              ))}
            </CardContent></Card>

          <Card><CardHeader><CardTitle>⑤ 修订终稿（按审稿意见）</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {res.final?.hooks && <Badge variant="secondary">钩子：{res.final.hooks}</Badge>}
                {res.final?.cta && <Badge variant="secondary">CTA：{res.final.cta}</Badge>}
                {(res.final?.tags || []).map((t: string, i: number) => <Badge key={i} variant="outline">{t}</Badge>)}
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed whitespace-pre-wrap">{res.final?.script}</div>
              {res.final?.storyboard && <Storyboard sb={res.final.storyboard} />}
              <p className="text-[11px] text-muted-foreground"><Check className="mr-1 inline h-3 w-3 text-emerald-500" /> 已按 4 角色意见修订，可直接进入拍摄。</p>
            </CardContent></Card>
        </div>
      )}
    </div>
  );
}
