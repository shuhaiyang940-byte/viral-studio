"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clapperboard,
  Clock,
  Layers,
  ArrowRight,
  Film,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShotDiagram } from "@/components/shot-diagram";
import { getStoryboards, setPendingAnalysis } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import type { Storyboard } from "@/lib/types";

export function StoryboardView({ id }: { id?: string }) {
  const [sb, setSb] = React.useState<Storyboard | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const found = id ? getStoryboards().find((s) => s.id === id) : undefined;
    setSb(found ?? null);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sb) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-lg font-semibold">没有找到这套分镜</p>
        <p className="mt-1 text-sm text-muted-foreground">
          它可能已被清除，或链接无效。回到分析报告重新生成即可。
        </p>
        <Button asChild className="mt-4">
          <Link href="/analyze">去分析一个视频</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* 头部 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clapperboard className="h-4 w-4" /> 导演分镜 ·{" "}
            {sb.source === "brief" ? "由你的需求生成" : "由 AI 分析自动派生"}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{sb.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Film className="h-3 w-3" /> {sb.shots.length} 个镜头
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> 总时长约 {sb.totalDurationSec} 秒
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3 w-3" /> 生成于 {formatDate(sb.createdAt)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {sb.source !== "brief" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/report?id=${sb.reportId}`}>看分析报告</Link>
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              setPendingAnalysis(sb.reportId);
              window.location.href = "/studio";
            }}
          >
            用这套分镜去智能剪辑 <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        说明：以下分镜由该视频的节奏段落、镜头清单与运镜建议自动生成，仅作拍摄参考。示意图为简易场景/人物/运镜示意（非真实画面），你可按实际场景调整人物与机位。
      </p>

      {/* 分镜表 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" /> 分镜头表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">镜号</th>
                  <th className="px-3 py-2 font-medium">示意图</th>
                  <th className="px-3 py-2 font-medium">段落 / 场景</th>
                  <th className="px-3 py-2 font-medium">人物关系</th>
                  <th className="px-3 py-2 font-medium">时长</th>
                  <th className="px-3 py-2 font-medium">运镜</th>
                  <th className="px-3 py-2 font-medium">注意事项</th>
                </tr>
              </thead>
              <tbody>
                {sb.shots.map((shot) => (
                  <tr key={shot.index} className="border-b border-border/60 align-top">
                    <td className="px-3 py-3 font-semibold text-primary">{shot.index}</td>
                    <td className="px-3 py-3">
                      <div className="h-24 w-40 overflow-hidden rounded-md border border-border bg-background">
                        <ShotDiagram shot={shot} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{shot.phase}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{shot.scene}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {shot.characters.map((c, i) => (
                          <Badge key={i} variant="outline" className="w-fit text-[11px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{shot.durationSec}s</td>
                    <td className="px-3 py-3 text-xs">{shot.camera}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{shot.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
