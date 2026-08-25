"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Flame, RefreshCw, ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const CATS = ["全部", "搞笑", "剧情", "测评", "美食", "知识", "颜值", "萌宠", "社会", "游戏", "带货"];

/** 内置精选选题（当全网热榜暂未抓到时兜底展示，也是稳定可用的灵感） */
const FALLBACK: any[] = [
  { title: "为什么你越努力越穷", category: "知识", platform: "全网热推", heat: 982, summary: "把努力与回报错位这个反常识点放大，戳中年轻人。", whyHot: "反常识开头 + 身份共鸣，完播率高。", tags: ["反常识", "身份共鸣"] },
  { title: "30 岁后才明白的 5 件事", category: "情感", platform: "抖音热榜", heat: 956, summary: "以「过来人」口吻列清单，每条一个真实细节。", whyHot: "认知反差 + 清单式，收藏率高。", tags: ["清单", "成长"] },
  { title: "一个人的深夜食堂", category: "美食", platform: "小红书热榜", heat: 931, summary: "深夜一人食，治愈感 + 简单做法，结尾留情绪。", whyHot: "治愈系情绪 + 生活场景，适合种草。", tags: ["治愈", "美食"] },
  { title: "普通人 vs 高手的一天", category: "知识", platform: "B站热榜", heat: 902, summary: "对比式结构，把差距可视化，结尾给方法论。", whyHot: "强对比 + 干货密度，转发率高。", tags: ["对比", "干货"] },
  { title: "我花了 1000 块，踩了这些坑", category: "测评", platform: "抖音热榜", heat: 875, summary: "真实花钱踩坑清单，用「别买」制造张力。", whyHot: "踩坑 + 说真话人设，信任感强。", tags: ["测评", "避坑"] },
  { title: "给打工人的一分钟自救", category: "情感", platform: "微信热文", heat: 843, summary: "情绪共鸣 + 立刻能做的小动作，结尾引导互动。", whyHot: "扎心 + 可行性，评论区活跃。", tags: ["情绪", "行动"] },
];

export default function IdeasPage() {
  const [cat, setCat] = React.useState("全部");
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<any[] | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/hotspots");
      const data = await res.json();
      const arr = Array.isArray(data.items) ? data.items : [];
      setItems(arr.length ? arr : FALLBACK);
      // 只要任一来源实时成功，即为「全网实时热榜」；否则视为「实时暂不可用」
      const sources = data.sources || {};
      setLive(Object.values(sources).some((v) => v === "ok"));
      setUpdatedAt(data.updatedAt || null);
    } catch {
      setItems(FALLBACK);
      setLive(false);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const filtered = (items || []).filter(
    (i) =>
      (cat === "全部" || i.category === cat) &&
      (!q || (i.title || "").includes(q) || (i.tags || []).some((t: string) => t.includes(q)))
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> 全网热榜 · 提炼成创意题材
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">创意选题库</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          抖音、微信、知乎等热门站点的实时热榜，自动提炼成「能拍」的题材。缺灵感时，来这里找下一条。
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {updatedAt ? `更新于 ${new Date(updatedAt).toLocaleString("zh-CN")}` : "联网时自动刷新热门"}
          <button onClick={load} className="inline-flex items-center gap-1 text-primary hover:underline" disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> 刷新
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜题材 / 标签" className="w-56 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                cat === c ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">没有匹配的选题，换个关键词试试。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => (
            <Card key={it.title + it.platform} className="card-glow-border hover:border-primary/40">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px]">{it.platform || "全网"}</Badge>
                  <span className="flex items-center gap-1 text-[11px] text-orange-500">
                    <Flame className="h-3 w-3" /> {it.heat || "--"}
                  </span>
                </div>
                <p className="font-semibold leading-snug">{it.title}</p>
                <p className="text-sm text-muted-foreground">{it.summary}</p>
                <p className="text-xs text-primary/80">{it.whyHot}</p>
                <div className="flex flex-wrap gap-1">
                  {(it.tags || []).slice(0, 3).map((t: string) => (
                    <Badge key={t} className="bg-primary/10 text-primary text-[10px]">{t}</Badge>
                  ))}
                </div>
                <Button asChild size="sm" variant="outline" className="mt-1 w-full gap-1.5">
                  <Link href={`/reengineer?product=${encodeURIComponent(it.title)}`}>
                    用它做我的下一条 <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
      {live
        ? `题材来自微博 / 百度 / 抖音 / 头条 / 知乎趋势等公开热榜（实时更新）。`
        : "当前实时热点暂不可用，以下为精选灵感库；联网后将自动并入全网实时热榜。"}
        点击任意题材，可一键带入「爆款搬运」生成你的脚本。
      </p>
    </div>
  );
}
