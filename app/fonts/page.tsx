"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, Search, Type, CheckCircle2, AlertTriangle, Tag, Layers } from "lucide-react";
import { FONT_LIBRARY, FONT_CATS, FONT_TAGS, downloadFontFile, type FontDef, type FontTag } from "@/lib/fonts";

function ensureFont(url: string) {
  if (typeof document === "undefined" || !url) return;
  const id = "font-" + url.replace(/[^a-z0-9]/gi, "");
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id; l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${url}&display=swap`;
  document.head.appendChild(l);
}

export default function FontsPage() {
  const [cat, setCat] = React.useState<string>("全部");
  const [activeTags, setActiveTags] = React.useState<FontTag[]>([]);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<Record<string, boolean>>({});
  const [done, setDone] = React.useState<Record<string, "ok" | "fallback" | null>>({});

  React.useEffect(() => {
    FONT_LIBRARY.forEach((f) => f.online !== false && ensureFont(f.url));
  }, []);

  const toggleTag = (t: FontTag) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const list = FONT_LIBRARY.filter((f) => {
    if (cat !== "全部" && f.cat !== cat) return false;
    if (activeTags.length && !activeTags.some((t) => f.tags.includes(t))) return false;
    if (q.trim() !== "") {
      const hay = (f.name + f.style + f.tags.join(" ")).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  async function handleDownload(f: FontDef) {
    if (f.online === false) {
      window.open(f.page, "_blank");
      return;
    }
    setBusy((b) => ({ ...b, [f.id]: true }));
    setDone((d) => ({ ...d, [f.id]: null }));
    const res = await downloadFontFile(f);
    setBusy((b) => ({ ...b, [f.id]: false }));
    setDone((d) => ({ ...d, [f.id]: res.ok ? "ok" : "fallback" }));
    if (!res.ok && res.fallback) window.open(res.fallback, "_blank");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Type className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">版权字体库</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          可商用免版权字体 · 按场景挑
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          全部可免费商用。每条都打了<strong className="text-slate-800">使用场景标签</strong>（字幕 / 封面 / 重点词 / 国风 / 可爱 / 手写 / 科技 / 文艺 / 电商 / 综艺 / 极简），
          先选场景、再选风格，挑完点「下载」即可装进剪映 / PR / FCP。
        </p>

        {/* 风格分类筛选 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Layers className="h-3.5 w-3.5" /> 风格分类
          </div>
          <div className="flex flex-wrap gap-2">
            {FONT_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  cat === c ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 使用场景标签（多选） */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Tag className="h-3.5 w-3.5" /> 使用场景（可多选）
          </div>
          <div className="flex flex-wrap gap-2">
            {FONT_TAGS.map((t) => {
              const on = activeTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {t}
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <button
                onClick={() => setActiveTags([])}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                清空（{activeTags.length}）
              </button>
            )}
          </div>
        </div>

        {/* 搜索 */}
        <div className="relative mt-5 w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索字体名 / 风格 / 标签"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 计数 */}
        <div className="mt-5 text-xs text-slate-500">共 {list.length} 款字体</div>

        {/* 字体网格 */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => {
            const offline = f.online === false;
            return (
              <div
                key={f.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {f.cat} · {f.style}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    {offline ? "需安装" : f.license}
                  </span>
                </div>

                <div
                  style={{ fontFamily: f.family }}
                  className="mt-3 truncate text-2xl text-slate-900"
                  title={`${f.name} 预览`}
                >
                  爆款文案 Aa 123
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {f.name}
                  {offline && <span className="ml-1 text-amber-600">· 安装后于剪辑器内预览真实效果</span>}
                </div>

                {/* 标签胶囊 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(f)}
                    disabled={busy[f.id]}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy[f.id] ? (
                      "下载中…"
                    ) : offline ? (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" /> 官网下载
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" /> 下载 woff2
                      </>
                    )}
                  </button>
                  <a
                    href={f.page}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> 官网
                  </a>
                </div>
                {done[f.id] === "ok" && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 已下载到本地
                  </div>
                )}
                {done[f.id] === "fallback" && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> 跨域受限，已为你打开下载页
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {list.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm text-slate-500">
            没有匹配的字体，换个关键词或清空标签试试。
          </div>
        )}

        <div className="mt-10 rounded-xl bg-slate-900 p-5 text-xs leading-relaxed text-slate-300">
          <p className="font-semibold text-white">关于版权</p>
          <p className="mt-1">
            本页字体均来自 Google Fonts（SIL OFL 等开源协议）或各大厂 / 公益发布的「免费商用」字体。
            发布前请按官网许可确认授权范围，尤其平台限定字体（如部分阿里 / 京东平台字体）。字体效果以实际软件渲染为准。
          </p>
          <p className="mt-2">
            标注「需安装」的字体无通用在线预览，下载安装后可在剪辑器内「字体」栏即点即套到花字 / 字幕；在线字体在这里直接下载 woff2。
          </p>
          <Link href="/studio" className="mt-3 inline-block font-medium text-primary hover:underline">
            前往智能剪辑 →
          </Link>
        </div>
      </div>
    </main>
  );
}
