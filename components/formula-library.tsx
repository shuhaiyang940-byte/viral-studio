"use client";

import * as React from "react";
import Link from "next/link";
import { Sigma, ArrowUpRight, Sparkles, Target, Layers } from "lucide-react";
import type { Category, FormulaTemplate } from "@/lib/types";
import { CATEGORIES, gradientFor } from "@/lib/mock-data";
import {
  FORMULA_LIBRARY,
  getFormulasByCategory,
  getFormulaById,
} from "@/lib/formula-library";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function FormulaLibrary({ focusId }: { focusId?: string }) {
  const [category, setCategory] = React.useState<"全部" | Category>("全部");
  const [detail, setDetail] = React.useState<FormulaTemplate | null>(null);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const items = React.useMemo(
    () => getFormulasByCategory(category),
    [category]
  );

  // 从报告页带入的 focus：自动打开对应公式详情
  React.useEffect(() => {
    if (focusId) {
      const f = getFormulaById(focusId);
      if (f) {
        setDetail(f);
        setOpen(true);
      }
    }
  }, [focusId]);

  function openDetail(f: FormulaTemplate) {
    setDetail(f);
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3 gap-1">
          <Sigma className="h-3 w-3" /> 爆款公式库
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">收藏的是套路，不是视频</h1>
        <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
          从真实爆款里提炼出的可复用公式。先看懂一条视频为什么火，再把同一套公式套到你的赛道上。
        </p>
      </div>

      {/* 分类筛选 */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {(["全部", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              category === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 网格 */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => {
          const focused = mounted && focusId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => openDetail(f)}
              className={cn(
                "group overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                focused && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <div
                className="relative flex h-24 items-center justify-center"
                style={{ background: gradientFor(i) }}
              >
                <Sigma className="h-8 w-8 text-white/90" />
                <Badge className="absolute left-3 top-3 bg-black/30 text-white backdrop-blur">
                  {f.category}
                </Badge>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white backdrop-blur">
                  <Target className="h-3 w-3" /> {f.hookType}
                </span>
              </div>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold leading-snug">{f.name}</h3>
                <p className="mt-2 line-clamp-1 text-xs font-medium text-primary">
                  {f.formula}
                </p>
                <div className="mt-3 space-y-1.5">
                  {f.factors.slice(0, 3).map((fac) => (
                    <div key={fac.name} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                        {fac.name}
                      </span>
                      <Progress value={fac.weight} className="h-1.5 flex-1" />
                      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {fac.weight}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {f.tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  查看完整公式 <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </button>
          );
        })}
      </div>

      {/* 详情弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{detail.category}</Badge>
                  <Badge variant="outline" className="gap-1 text-primary">
                    <Target className="h-3 w-3" /> {detail.hookType}
                  </Badge>
                </div>
                <DialogTitle className="mt-2 text-xl">{detail.name}</DialogTitle>
                <DialogDescription>{detail.whenToUse}</DialogDescription>
              </DialogHeader>

              {/* 公式 */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sigma className="h-3.5 w-3.5" /> 爆款公式
                </div>
                <p className="mt-1.5 text-lg font-bold text-primary">{detail.formula}</p>
              </div>

              {/* 因子权重 */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Layers className="h-4 w-4 text-primary" /> 因子权重
                </div>
                {detail.factors.map((fac) => (
                  <div key={fac.name} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{fac.name}</span>
                      <span className="font-semibold tabular-nums text-primary">{fac.weight}%</span>
                    </div>
                    <Progress value={fac.weight} className="mt-2" />
                    <p className="mt-2 text-sm text-muted-foreground">{fac.tip}</p>
                  </div>
                ))}
              </div>

              {/* 套用示例 + 复刻路径 */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">套用示例</div>
                  <p className="text-sm">{detail.example}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">复刻路径</div>
                  <p className="text-sm">{detail.copyPath}</p>
                </div>
              </div>

              {/* 标签 */}
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>

              {/* CTA：用此公式一键复刻（Phase 5 复刻助手） */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  想直接套用？用这条公式，一键生成你的专属标题 / 脚本 / 分镜。
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/replicate?formula=${detail.id}`}>
                    用此公式复刻 <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
