"use client";

import * as React from "react";
import Link from "next/link";
import {
  PenLine,
  Copy,
  Check,
  Sparkles,
  Info,
  Crown,
  ArrowRight,
  Wand2,
  ShieldCheck,
  Flame,
  MessagesSquare,
  Lightbulb,
} from "lucide-react";
import {
  generateCopy,
  COPY_TYPES,
  NEWS_FEEDBACK,
  getCopySuggestions,
  analyzeNewsTopic,
  type CopyType,
  type GeneratedCopy,
  type NewsAnalysis,
  type CopyFeedbackQuestion,
} from "@/lib/copywrite";
import { CREATOR_STYLES, AUDIENCE_OPTIONS } from "@/lib/types";
import { getProfile } from "@/lib/onboarding";
import { useSession } from "@/lib/auth";

function catToType(cat?: string): CopyType {
  switch (cat) {
    case "剧情":
      return "剧情";
    case "测评":
      return "测评";
    case "知识":
      return "知识";
    case "带货":
      return "带货";
    default:
      return "口播";
  }
}

export default function CopywritingPage() {
  const { session } = useSession();
  const [reportId, setReportId] = React.useState<string | null>(null);

  const [reference, setReference] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [type, setType] = React.useState<CopyType>("口播");
  const [tone, setTone] = React.useState("");
  const [style, setStyle] = React.useState<string>("严谨客观");
  const [audience, setAudience] = React.useState<string>("泛大众");

  const [topic, setTopic] = React.useState<string | null>(null);
  const [topicCat, setTopicCat] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<string | null>(null);

  // 新闻拆解：反馈型提问答案
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  // 免费用户点击生成时才弹升级
  const [showUpgrade, setShowUpgrade] = React.useState(false);

  // ── AI 动态分析状态 ──
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<NewsAnalysis | null>(null);

  const [result, setResult] = React.useState<GeneratedCopy | null>(null);
  const [resultSource, setResultSource] = React.useState<"llm" | "template" | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const suggestions = React.useMemo(
    () => (analysis?.suggestions ?? getCopySuggestions(topicCat ?? undefined, topic ?? undefined)),
    [analysis, topicCat, topic]
  );

  // 动态问题列表（AI 分析后使用，分析前用兜底）
  const dynamicQuestions: CopyFeedbackQuestion[] = React.useMemo(
    () => analysis?.questions ?? NEWS_FEEDBACK,
    [analysis]
  );

  // 有热点时自动触发 AI 分析
  React.useEffect(() => {
    if (!topic) {
      setAnalysis(null);
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    // 模拟 AI 分析延迟（让用户感知到"在思考"）
    const timer = setTimeout(() => {
      const result = analyzeNewsTopic(topic, topicCat ?? undefined);
      setAnalysis(result);
      setAnalyzing(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [topic, topicCat]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const t = params.get("topic");
    const c = params.get("cat");
    const s = params.get("source");
    if (id) setReportId(id);
    const profile = getProfile();
    if (profile?.style) setStyle(profile.style);
    if (profile?.audience) setAudience(profile.audience);
    if (t) {
      setTopic(t);
      setDirection(t);
    }
    if (c) {
      setTopicCat(c);
      setType(catToType(c));
    }
    if (s) setSource(s);
  }, []);

  const locked = !session?.isPro;

  function buildConstraints(): string[] {
    return dynamicQuestions
      .map((q) => answers[q.id])
      .filter((v): v is string => Boolean(v));
  }

  async function handleGenerate() {
    setCopied(false);
    if (locked) {
      setShowUpgrade(true);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: reference.trim() || undefined,
          topic: topic ?? undefined,
          direction,
          type,
          tone: tone.trim() || undefined,
          style,
          audience,
          constraints: buildConstraints(),
        }),
      });
      if (!res.ok) throw new Error("copy api " + res.status);
      const data = (await res.json()) as GeneratedCopy & { source?: "llm" | "template" };
      setResult(data);
      setResultSource(data.source ?? "template");
    } catch {
      // 接口异常时回退本地模板，保证永远能出稿
      setResult(
        generateCopy({
          reference: reference.trim() || undefined,
          topic: topic ?? undefined,
          direction,
          type,
          tone: tone.trim() || undefined,
          style,
          audience,
          constraints: buildConstraints(),
        })
      );
      setResultSource("template");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <PenLine className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">AI 写文案</span>
          <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            高级 · 收费内容
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          结合你的风格，把热点写成能发的稿子
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          根据你填写的<strong className="text-slate-800">创作档案</strong>（风格 / 受众），把热点或你的新方向，
          直接写成贴合你人设的文案。先拆解热点、答几个问题收窄方向，生成时再决定要不要升级。
        </p>

        {reportId && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
            <Wand2 className="h-3.5 w-3.5" /> 来自分析报告 #{reportId.slice(0, 8)}
          </div>
        )}

        {topic && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <Flame className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              热点选题：<strong className="mr-1">{topic}</strong>
              {source && <span className="text-red-600/80">（来源：{source}）</span>}
              <span className="ml-1 text-red-600/70">——下面已自动带入「方向」，先拆解再生成</span>
            </div>
          </div>
        )}

        {/* 新闻拆解 & 文案建议（热点场景）— AI 动态分析 */}
        {topic && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 text-indigo-700">
              {analyzing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  <span className="text-sm font-semibold">AI 正在分析这条热点…</span>
                </>
              ) : analysis ? (
                <>
                  <MessagesSquare className="h-4 w-4" />
                  <span className="text-sm font-semibold">AI 拆解结果</span>
                  {analysis.themeLabel && (
                    <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-600 shadow-sm">
                      {analysis.themeLabel}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <MessagesSquare className="h-4 w-4" />
                  <span className="text-sm font-semibold">新闻拆解 · 先答几个问题收窄方向</span>
                </>
              )}
            </div>

            {/* 加载中骨架屏 */}
            {analyzing && (
              <div className="mt-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-indigo-200/60" />
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-8 w-20 animate-pulse rounded-full bg-indigo-200/40" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 分析完成：动态提问 + 建议 */}
            {!analyzing && analysis && (
              <>
                <p className="mt-1 text-xs text-indigo-600/80">
                  以下提问根据「<strong>{topic}</strong>」的标题内容自动生成，不同热点会展示不同问题。答案会一并交给生成，不答也能生成。
                </p>

                {/* 动态问题列表（主问题 + 子问题） */}
                <div className="mt-4 space-y-4">
                  {dynamicQuestions.map((q, qi) => (
                    <div key={q.id}>
                      {/* 主问题或子问题的缩进区分 */}
                      <div className={`mb-2 flex items-center gap-2 ${qi > 0 ? "ml-4 border-l-2 border-indigo-200 pl-3" : ""}`}>
                        <div className="text-sm font-medium text-slate-700">{q.q}</div>
                        {qi > 0 && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-500">追问</span>
                        )}
                      </div>
                      <div className={`${qi > 0 ? "ml-7" : ""} flex flex-wrap gap-2`}>
                        {q.options.map((opt) => {
                          const on = answers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: on ? "" : opt }))}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                on
                                  ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 针对性文案建议（嵌入标题内容） */}
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Lightbulb className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                      文案建议
                      {analysis?.themeLabel && (
                        <span className="ml-1 font-normal text-amber-600">（基于{analysis.themeLabel}主题）</span>
                      )}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-amber-800">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* 生成表单（始终可见可填） */}
        <div className="mt-8 grid grid-cols-1 gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              参考文案（可选，粘贴原文 / 连接视频抓取）
            </label>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={3}
              placeholder="把参考视频的文案粘到这里。留空也会按所选类型与你的风格生成。"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              方向 / 主题 {topic ? "（已带入热点，可改）" : ""}
            </label>
            <input
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="例如：职场新人如何快速被看见"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CopyType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            >
              {COPY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">创作风格（来自你的档案）</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            >
              {CREATOR_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">目标受众（来自你的档案）</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              语气偏好（可选，覆盖风格默认）
            </label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="例如：毒舌但真诚 / 温柔治愈 / 热血励志"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  生成中…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> 生成文案
                </>
              )}
            </button>
            {locked && (
              <span className="text-xs text-slate-500">
                生成功能为高级会员专享，点上面即可预览需解锁的环节
              </span>
            )}
          </div>
        </div>

        {/* 合规声明 */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          所有生成内容均需符合法律法规与平台规范：禁止造谣传谣、人身攻击、网暴、色情、赌博、诈骗等违法违规内容。
          文案由 DeepSeek 生成（未配置 Key 时回退本地模板），已叠加关键词合规软过滤；发布前请核实信息来源，必要时接入云厂内容安全审核 API。
        </div>

        {/* 升级解锁（点击生成时才出现） */}
        {showUpgrade && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <Crown className="mx-auto h-8 w-8 text-amber-500" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">解锁「按你的风格 + 热点」一键写稿</h2>
            <p className="mt-2 text-sm text-slate-600">
              已为你预填热点选题
              {topic && <strong className="mx-1 text-slate-800">{topic}</strong>}
              与创作偏好（{style} · {audience}）
              {buildConstraints().length > 0 && (
                <>，并带入拆解约束：{buildConstraints().join(" / ")}</>
              )}
              。升级后即可一键生成贴合你人设的成稿。
            </p>
            <Link
              href="/pricing?feature=copywrite"
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              升级解锁 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* 生成结果（付费用户） */}
        {result && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <PenLine className="h-4 w-4 text-primary" /> 生成结果
                {resultSource === "llm" && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <Sparkles className="h-3 w-3" /> DeepSeek 生成
                  </span>
                )}
                {resultSource === "template" && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    模板示例
                  </span>
                )}
                {result.styleNote && (
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {style} · {result.styleNote}
                  </span>
                )}
              </h2>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "已复制" : "复制全文"}
              </button>
            </div>

            {result.legal.flagged && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                合规提示：检测到可能涉及{result.legal.hits.join("、")}的内容，请核实信息来源、遵守法律法规与平台规范，勿传播未经证实的信息。
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">钩子</div>
                <p className="mt-1 text-sm text-slate-800">{result.hook}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">正文要点</div>
                <ul className="mt-1 space-y-1">
                  {result.body.map((b, i) => (
                    <li key={i} className="text-sm text-slate-800">
                      · {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">结尾号召</div>
                <p className="mt-1 text-sm text-slate-800">{result.cta}</p>
              </div>
            </div>

            <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {result.full}
            </pre>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              当前为<strong className="mx-1">模板启发生成（示例）</strong>。接入真实 LLM 后，会按你参考文案的风格与质量输出更接近的真文案；
              切换点见 <code className="text-amber-900">lib/copywrite.ts</code> 的 generateCopy()。
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
