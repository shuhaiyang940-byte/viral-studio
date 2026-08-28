"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Row {
  id: number;
  session_id: string;
  file_name: string;
  file_size: number;
  step: string;
  detail: string;
  ok: boolean | null;
  user_agent: string;
  created_at: string;
}

const STEP_LABEL: Record<string, string> = {
  video_add: "加入队列",
  video_start: "开始上传",
  ticket_fetch: "请求票据",
  ticket_result: "票据返回",
  blob_upload_start: "Blob 握手开始",
  blob_upload_progress: "Blob 上传进度",
  blob_upload_done: "Blob 上传成功",
  blob_upload_error: "Blob 上传失败",
  local_upload: "本机上传",
  analyze_start: "AI 分析开始",
  analyze_done: "AI 分析完成",
  analyze_error: "AI 分析失败",
  process_error: "处理失败",
  screenshot_start: "截图上传",
  screenshot_blob_done: "截图上传成功",
  screenshot_blob_error: "截图上传失败",
  screenshot_error: "截图失败",
};

export default function DiagnosisLogsPage() {
  const [token, setToken] = React.useState("");
  const [sessionId, setSessionId] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function refresh() {
    if (!token) {
      setError("请填入 ADMIN_TOKEN（在 Vercel 环境变量中可查）");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (sessionId.trim()) params.set("sessionId", sessionId.trim());
      const res = await fetch(`/api/diagnosis/logs?${params.toString()}`, {
        headers: { "x-admin-token": token },
      });
      if (res.status === 401) {
        setError("ADMIN_TOKEN 无效");
        setRows([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setRows(data.rows || []);
      if (!data.rows) setError("无数据或读取失败");
    } catch (e: any) {
      setError(e?.message || "查询失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">账号诊断 · 上传日志</h1>
      <p className="mb-4 text-muted-foreground text-sm">
        排查「上传卡 0%」等故障：每一次上传会记录 票据→Blob握手→进度→完成 每一步。用 ADMIN_TOKEN 查询。
      </p>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">ADMIN_TOKEN</label>
            <Input value={token} type="password" onChange={(e) => setToken(e.target.value)} placeholder="填入 ADMIN_TOKEN" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">按会话过滤（sessionId，选填）</label>
            <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} placeholder="diag_xxxx（不填则看最近 200 条）" />
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? "查询中…" : "查询日志"}
          </Button>
        </CardContent>
      </Card>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>最近上传活动（{rows.length} 条）</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">时间</th>
                <th className="py-2 pr-3">会话</th>
                <th className="py-2 pr-3">步骤</th>
                <th className="py-2 pr-3">文件</th>
                <th className="py-2 pr-3">大小</th>
                <th className="py-2 pr-3">结果</th>
                <th className="py-2">详情</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("zh-CN")}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.session_id.slice(0, 14)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{STEP_LABEL[r.step] || r.step}</td>
                  <td className="py-2 pr-3 max-w-[200px] truncate" title={r.file_name}>
                    {r.file_name || "-"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{r.file_size ? (r.file_size / 1024 / 1024).toFixed(2) + " MB" : "-"}</td>
                  <td className="py-2 pr-3">
                    {r.ok === null || r.ok === undefined ? "-" : r.ok ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗</span>}
                  </td>
                  <td className="py-2 max-w-[360px] break-all">{r.detail || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">暂无日志</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
