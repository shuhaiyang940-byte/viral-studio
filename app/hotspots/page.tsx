"use client";

import * as React from "react";
import Link from "next/link";
import { Flame, TrendingUp, ArrowRight, Radio, Info, Sparkles, ExternalLink, X, Lightbulb, ListTree, Eye } from "lucide-react";
import {
  HOTSPOT_CATEGORIES,
  fetchHotspotTimeline,
  fetchHotspotDetail,
  fetchHotspotsInfo,
  type HotspotTimeline,
  type HotspotTitle,
  type HotspotDetail,
  type HotspotCat,
  type HotspotsInfo,
} from "@/lib/hotspots";

function fmtHeat(n: number): string {
  if (!n) return "—";
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return String(n);
}

function fmtDay(d: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d === today) return "今天";
  if (d === yest) return "昨天";
  const dt = new Date(d + "T00:00:00");
  const wd = ["日", "一", "二", "三", "四", "五", "六"][dt.getDay()];
  return `${dt.getMonth() + 1}月${dt.getDate()}日 · 周${wd}`;
}

function CatChip({ c }: { c: HotspotCat }) {
  return (
    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
      {c}
    </span>
  );
}

export default function HotspotsPage() {
  const [cat, setCat] = React.useState<HotspotCat | "全部">("全部");
  const [data, setData] = React.useState<HotspotTimeline | null>(null);
  const [info, setInfo] = React.useState<HotspotsInfo>({ updatedAt: "", sources: {}, live: false });

  // 详情弹窗状态
  const [detail, setDetail] = React.useState<HotspotDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setData(null);
    fetchHotspotTimeline(cat === "全部" ? undefined : cat).then((r) => {
      if (alive) setData(r);
    });
    fetchHotspotsInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, [cat]);

  // Esc 关闭弹窗
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openDetail(t: HotspotTitle) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    const d = await fetchHotspotDetail(t.id);
    setDetail(d);
    setDetailLoading(false);
  }

  const dayKeys = data ? Object.keys(data.days).sort((a, b) => (a < b ? 1 : -1)) : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Flame className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">热点追踪</span>
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            实时灵感库
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          全网热点 · 时间轴 · 一键追踪
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          后台爬虫持续扫描微博 / 百度 / 抖音 / 知乎 / 头条 的最新爆点与笑点，按日期沉淀成时间轴（保留 30 天）。
          网站内只存标题，点进去才会按需生成创作参考并落盘，不浪费存储。
        </p>

        {info.live ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
            <span className="inline-flex items-center gap-1 font-medium">
              <Radio className="h-3.5 w-3.5" /> 实时数据
            </span>
            <span>
              更新于 {info.updatedAt ? new Date(info.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
            </span>
            <span className="text-emerald-700/80">
              数据源：
              {Object.entries(info.sources).map(([k, v]) => (
                <span key={k} className={v === "ok" ? "text-emerald-700" : "text-slate-400 line-through"}>
                  {k}
                  {v === "ok" ? " " : "(离线) "}
                </span>
              ))}
            </span>
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            实时接口暂不可用，当前显示<strong className="mx-1">示例时间轴</strong>。部署后由后台爬虫自动替换为实时热点。
          </div>
        )}

        {/* 类目筛选 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(["全部", ...HOTSPOT_CATEGORIES] as (HotspotCat | "全部")[]).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                cat === c ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 时间轴 */}
        {!data ? (
          <div className="mt-8 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : dayKeys.length === 0 ? (
          <div className="mt-10 text-center text-sm text-slate-400">该类目暂无热点，换个类目看看～</div>
        ) : (
          <div className="mt-8 space-y-10">
            {dayKeys.map((day) => {
              const items = data.days[day];
              return (
                <section key={day} className="relative">
                  {/* 时间轴节点 + 日期 */}
                  <div className="sticky top-2 z-10 mb-4 flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                    </span>
                    <h2 className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 backdrop-blur">
                      {fmtDay(day)}
                      <span className="ml-2 text-xs font-normal text-slate-400">{items.length} 条</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pl-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((h) => (
                      <div
                        key={h.id}
                        className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <CatChip c={h.category} />
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                            {fmtHeat(h.heat)}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold leading-snug text-slate-900">{h.title}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {h.platform}
                          {h.seed ? " · 示例" : ""} · {h.date}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(h.tags || []).map((t) => (
                            <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                              #{t}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => openDetail(h)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            <Eye className="h-4 w-4" /> 查看详情
                          </button>
                          {h.url && (
                            <a
                              href={h.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                              title="查看原帖"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <Link
                          href={`/copywriting?topic=${encodeURIComponent(h.title)}&cat=${encodeURIComponent(h.category)}&source=${encodeURIComponent(h.platform)}`}
                          className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-white px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                        >
                          <Sparkles className="h-4 w-4" /> 据此写文案
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
          <Radio className="mr-1 inline h-3.5 w-3.5" />
          实时数据由后台定时爬虫拉取（微博 / 百度 / 抖音 / 知乎 / 头条 未鉴权热榜），跨源去重归一后按日期沉淀为时间轴，保留 30 天。
          分类当前为「关键词打分 + 平台先验」启发式，设置 <code className="text-slate-700">LLM_API_KEY</code> 后可切换为 AI 精准分类。
          网站内仅持久化标题，点击「查看详情」才生成并存储创作参考（非新闻原文）。知乎为搜索趋势词（非严格热榜），已在来源中标注。
        </div>
      </div>

      {/* 详情弹窗（懒加载 + 落盘） */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setDetailOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="热点详情"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CatChip c={detail?.category || "其他"} />
                <h3 className="mt-2 text-lg font-bold leading-snug text-slate-900">
                  {detail?.title ?? "加载中…"}
                </h3>
                {detail && (
                  <p className="mt-1 text-xs text-slate-400">
                    {detail.platform} · 热度 {fmtHeat(detail.heat)} · 已被查看 {detail.clicks} 次
                  </p>
                )}
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="mt-6 space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
            ) : detail ? (
              <div className="mt-4 space-y-5">
                <section>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> 创作参考
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{detail.summary}</p>
                </section>

                <section>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Sparkles className="h-4 w-4 text-primary" /> 三个创作角度
                  </h4>
                  <ul className="mt-1.5 space-y-1.5">
                    {detail.angles.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <ListTree className="h-4 w-4 text-slate-500" /> 文案 / 视频大纲
                  </h4>
                  <ol className="mt-1.5 space-y-1.5">
                    {detail.outline.map((o, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-500">
                          {i + 1}
                        </span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="rounded-lg bg-slate-50 px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-medium text-slate-700">为什么火：</span>
                    {detail.whyHot}
                  </p>
                </section>

                <p className="text-[11px] leading-relaxed text-slate-400">{detail.sourceNote}</p>

                <Link
                  href={`/copywriting?topic=${encodeURIComponent(detail.title)}&cat=${encodeURIComponent(detail.category)}&source=${encodeURIComponent(detail.platform)}`}
                  onClick={() => setDetailOpen(false)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" /> 据此写文案
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">未找到该热点的详情。</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
