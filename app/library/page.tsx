"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayCircle, Eye, ArrowUpRight, Bookmark, Plus, LogIn } from "lucide-react";
import type { Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/mock-data";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn, formatNumber } from "@/lib/utils";

type CaseItem = {
  id: string;
  title: string;
  category: string;
  cover: string;
  views: number;
  score: number;
  summary: string;
  tags: string[];
  isSeed: boolean;
  saved: boolean;
};

type ContributeForm = {
  title: string;
  category: string;
  summary: string;
  tags: string;
  score: string;
  views: string;
};

const EMPTY_FORM: ContributeForm = {
  title: "",
  category: "生活",
  summary: "",
  tags: "",
  score: "",
  views: "",
};

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<CaseItem[]>([]);
  const [category, setCategory] = React.useState<"全部" | Category>("全部");
  const [loading, setLoading] = React.useState(true);
  /** 会话以服务端 Cookie 为准，useSession 会自动回读 /api/auth/me */
  const { session } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ContributeForm>(EMPTY_FORM);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const load = React.useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cat !== "全部") params.set("category", cat);
      const res = await fetch(`/api/library?${params.toString()}`);
      const d = await res.json();
      setItems(d.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 登录状态变化后要重拉，否则 saved 标记还是登录前的
  React.useEffect(() => {
    load(category);
  }, [category, load, session?.userId]);

  async function toggleSave(it: CaseItem) {
    if (!mounted || !session) {
      router.push("/login");
      return;
    }
    if (savingId) return;
    const next = !it.saved;
    setSavingId(it.id);
    // 乐观更新
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, saved: next } : x)));
    try {
      const res = next
        ? await fetch("/api/library/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: it.id }),
          })
        : await fetch(`/api/library/saved?caseId=${it.id}`, { method: "DELETE" });
      // 只 catch 网络错误是不够的：401 / 503 也会 resolve，必须看状态码，否则会「假收藏」
      if (!res.ok) {
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, saved: !next } : x)));
        if (res.status === 401) router.push("/login?redirect=/library");
      }
    } catch {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, saved: !next } : x)));
    } finally {
      setSavingId(null);
    }
  }

  async function submitContribute() {
    if (!form.title.trim()) return;
    if (!mounted || !session) {
      router.push("/login?redirect=/library");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          summary: form.summary.trim(),
          tags: form.tags
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          score: Number(form.score) || 0,
          views: Number(form.views) || 0,
        }),
      });
      if (res.ok) {
        setAddOpen(false);
        setForm(EMPTY_FORM);
        load(category);
      } else {
        // 失败不能静默：503 = 未配置数据库，401 = 会话过期
        const d = await res.json().catch(() => ({}));
        setAddError(d.error || (res.status === 503 ? "服务端未配置数据库，暂时无法投稿" : "提交失败，请稍后重试"));
        if (res.status === 401) router.push("/login?redirect=/library");
      }
    } catch {
      setAddError("网络异常，请检查连接后重试");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Badge variant="secondary" className="mb-3">爆款案例库</Badge>
        <h1 className="text-3xl font-bold tracking-tight">向已经火过的视频学习</h1>
        <p className="mt-3 text-muted-foreground">
          精选各品类爆款，AI 拆解其结构与可复制方法。登录后可收藏案例、或贡献你见过的爆款。
        </p>
        <p className="mx-auto mt-3 max-w-xl rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          当前案例库中的示例案例为演示数据（用于展示功能），不代表真实爆款视频；你投稿的案例会如实展示来源。
        </p>
      </div>

      {/* 分类筛选 + 贡献 */}
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
        <Button size="sm" variant="outline" className="ml-2" onClick={() => (mounted && session ? setAddOpen(true) : router.push("/login"))}>
          <Plus className="h-4 w-4" /> 贡献案例
        </Button>
      </div>

      {/* 网格 */}
      {loading ? (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <p className="text-sm">这个分类下还没有案例，换个分类或点「贡献案例」补充。</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
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
                <button
                  onClick={() => toggleSave(item)}
                  disabled={savingId === item.id}
                  title={item.saved ? "取消收藏" : "收藏"}
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
                >
                  <Bookmark className={cn("h-3.5 w-3.5", item.saved && "fill-white")} />
                </button>
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

      {/* 贡献案例 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>贡献一个爆款案例</DialogTitle>
            <DialogDescription>把你见过的爆款视频拆解要点记下来，提交后会进入案例库。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">标题 *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：北京胡同三十年的告别" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">类目</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={
                        "rounded-full border px-3 py-1 text-xs " +
                        (form.category === c ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">综合分</label>
                  <Input value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="如：87" inputMode="numeric" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">播放量</label>
                  <Input value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} placeholder="如：3860000" inputMode="numeric" />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">一句话拆解</label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="这个视频为什么火？核心手法是什么？" rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">标签（逗号分隔）</label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="情感, 城市变迁, 第一人称" />
            </div>
          </div>
          {addError && (
            <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {addError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={submitContribute} disabled={addLoading || !form.title.trim()}>
              {addLoading ? "提交中…" : "提交"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
