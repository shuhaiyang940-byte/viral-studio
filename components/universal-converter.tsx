"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Pin, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth";

const NICHES = ["知识口播", "美妆种草", "数码带货", "情感共鸣", "美食", "商业"];
const PRESETS = [
  { label: "知识口播", product: "我是教人学英语的" },
  { label: "数码带货", product: "我卖桌面小风扇" },
  { label: "美妆种草", product: "我卖敏感肌修护霜" },
  { label: "情感共鸣", product: "我是情感博主" },
];

export function UniversalConverter() {
  const router = useRouter();
  const { session } = useSession();
  const [text, setText] = React.useState("");
  const [niche, setNiche] = React.useState("知识口播");
  const [product, setProduct] = React.useState("");
  const [persona, setPersona] = React.useState("");
  const [platform, setPlatform] = React.useState("抖音");
  const [hint, setHint] = React.useState("");

  function go() {
    const ta = text.trim();
    // 1) 什么都没填：不硬跳，明确提示（避免"点了没反应/跳到无关页"）
    if (!ta && !product.trim()) {
      setHint("请先粘贴一个视频链接，或填一个主题 / 创作方向，再点生成");
      return;
    }
    const params = new URLSearchParams();
    if (ta) params.set("text", ta);
    if (product.trim()) params.set("product", product.trim());
    if (persona.trim()) params.set("persona", persona.trim());
    if (platform.trim()) params.set("platform", platform.trim());
    if (niche) params.set("niche", niche);
    const isLink = /douyin|iesdouyin|tiktok|xiaohongshu|xhslink|bilibili|b23|weixin|channels|http|https|www\./i.test(ta);
    const to = (p: string) => router.push(session ? p : `/login?redirect=${encodeURIComponent(p)}`);
    // 2) 视频链接 → 去"拆解/分析"这个视频
    if (isLink) {
      to(`/analyze?url=${encodeURIComponent(ta)}`);
      return;
    }
    // 3) 文案 / 主题 → 去"用它创作/复刻"
    if (ta) {
      to(`/reengineer?${params}`);
      return;
    }
    // 4) 只填了产品/赛道（没填文案）→ 走三栏画布
    to(`/studio?${params}`);
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[52px]">
          把别人的爆款，
          <br />
          <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
            一键变成你的镜头脚本
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          不用学复杂提示词。输入任意爆款链接或文案，AI 帮你拆解心理逻辑，再换成你的产品，
          直接生成带拍摄指导的口播稿。
        </p>
      </div>

      {/* 万能输入转换框 */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xl shadow-black/20 backdrop-blur">
        <div className="relative">
          <Pin className="absolute left-3 top-3 h-4 w-4 text-primary" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="📌 粘贴抖音 / 小红书 / TikTok 视频链接或文案…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background/60 px-10 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">我的赛道</label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm"
            >
              {NICHES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">我的主题 / 创作方向（不卖东西就填主题）</label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="如：如何高效学习（主题）；要带货才补产品，如：手工辣酱" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">我的人设</label>
            <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="如：十年餐饮店主" />
          </div>
        </div>

        <div className="mt-4">
          {hint && (
            <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{hint}</p>
          )}
          <Button size="lg" variant="gradient" className="w-full gap-2 glow-purple" onClick={go}>
            <Wand2 className="h-4 w-4" /> 一键生成我的复刻脚本
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            贴视频链接 = 拆解它；填主题/文案 = 用它创作你的内容。空着点会提示你，不会白跳。
          </p>
        </div>
      </div>

      {/* 快捷预设 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">试一试热门赛道：</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setNiche(p.label);
              setProduct(p.product);
            }}
            className="rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> 公测中 · 全站免费
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          AI 导演 · 三步出片
        </span>
      </div>
    </div>
  );
}
