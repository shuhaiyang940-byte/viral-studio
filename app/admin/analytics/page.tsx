"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FUNNEL_LABEL: Record<string, string> = {
  signup: "注册", analyze_started: "开始分析", analyze_completed: "完成分析",
  start_creation_clicked: "开始创作", script_generated: "生成脚本",
  storyboard_generated: "生成分镜", plan_generated: "生成拍摄计划", export_completed: "导出",
};

export default function AdminAnalyticsPage() {
  const [token, setToken] = React.useState("");
  const [data, setData] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/analytics/summary", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "无法加载"); return; }
      setData(d);
    } catch { setErr("网络异常"); } finally { setLoading(false); }
  }

  const fmt = (v: any) => (v === null ? "—" : v ?? "—");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-xs text-muted-foreground">管理员只读汇总 · 数据来自真实事件 · 时区用 UTC</p>
      <div className="mt-4 flex gap-2">
        <Input type="password" placeholder="管理员口令（ADMIN_TOKEN）" value={token} onChange={(e) => setToken(e.target.value)} />
        <Button onClick={load} disabled={loading || !token}>{loading ? "加载中…" : "查看"}</Button>
      </div>
      {err && <p className="mt-3 text-xs text-destructive">{err}</p>}

      {data && (
        <div className="mt-6 space-y-5">
          <Card><CardHeader><CardTitle className="text-sm">用户</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">注册用户：</span><b>{data.metrics.registeredUsers}</b></p>
              <p><span className="text-muted-foreground">近 7 天活跃：</span><b>{data.metrics.activeUsers7d}</b></p>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-sm">Funnel</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {Object.keys(FUNNEL_LABEL).map((k) => (
                <p key={k} className="flex justify-between border-b border-border/40 pb-1"><span>{FUNNEL_LABEL[k]}</span><b>{data.funnel[k] ?? 0}</b></p>
              ))}
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-sm">留存（UTC）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <p>D1：<b>{data.retention.d1.retained}</b>/{data.retention.d1.eligible}（{fmt(data.retention.d1.rate)}%）</p>
              <p>D7：<b>{data.retention.d7.retained}</b>/{data.retention.d7.eligible}（{fmt(data.retention.d7.rate)}%）</p>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-sm">AI / 系统</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex justify-between"><span>AI 失败</span><b>{data.health.aiFailures}</b></p>
              <p className="flex justify-between"><span>系统错误</span><b>{data.health.systemErrors}</b></p>
              <div className="space-y-1 pt-2">
                {Object.entries(data.health.byEndpoint || {}).map(([ep, v]: any) => (
                  <p key={ep} className="flex justify-between text-xs text-muted-foreground">
                    <span>{ep}</span>
                    <span>5xx:{v.r5xx} · 502:{v.r502} · 429:{v.r429} · 系统:{v.system}</span>
                  </p>
                ))}
              </div>
            </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-sm">Token</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {data.tokenUsage.hasData ? `${data.tokenUsage} （真实）` : "NO DATA（provider 未返回 usage，不做估算）"}
            </CardContent></Card>
        </div>
      )}
    </div>
  );
}
