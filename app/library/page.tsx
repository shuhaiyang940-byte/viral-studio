"use client";

import * as React from "react";
import Link from "next/link";
import { PlayCircle, Eye, ArrowUpRight } from "lucide-react";
import type { Category, LibraryItem } from "@/lib/types";
import { CATEGORIES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";

export default function LibraryPage() {
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [category, setCategory] = React.useState<"全部" | Category>("全部");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    category === "全部" ? items : items.filter((i) => i.category === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3">爆款案例库</Badge>
        <h1 className="text-3xl font-bold tracking-tight">向已经火过的视频学习</h1>
        <p className="mt-3 text-muted-foreground">
          精选各品类爆款，AI 拆解其结构与可复制方法。
        </p>
      </div>

      {/* 分类筛选 */}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
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
      {loading ? (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
              <div
                className="relative flex h-36 items-center justify-center"
                style={{ background: item.cover }}
              >
                <PlayCircle className="h-10 w-10 text-white/90" />
                <Badge className="absolute left-3 top-3 bg-black/30 text-white backdrop-blur">
                  {item.category}
                </Badge>
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white backdrop-blur">
                  <Eye className="h-3 w-3" /> {formatNumber(item.views)}
                </span>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {item.title}
                  </h3>
                  <span className="shrink-0 rounded-md bg-success/10 px-2 py-1 text-xs font-bold text-success">
                    {item.score}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {item.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-3 w-full justify-between">
                  <Link href="/report">
                    查看完整拆解 <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
