"use client";

import * as React from "react";
import { Sparkles, Check, ArrowRight, Wand2 } from "lucide-react";
import {
  QUIZ,
  generateAdvice,
  saveProfile,
  type AdviceResult,
} from "@/lib/onboarding";
import type { OnboardingProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RawAnswers = Record<string, string | string[]>;

/** 存储「其他」手填的自定义值 */
type OtherValues = Record<string, string>;

export function OnboardingQuiz({
  onComplete,
}: {
  onComplete: (profile: OnboardingProfile) => void;
}) {
  const [answers, setAnswers] = React.useState<RawAnswers>({});
  const [otherValues, setOtherValues] = React.useState<OtherValues>({});
  const [advice, setAdvice] = React.useState<AdviceResult | null>(null);

  function toggle(questionId: string, value: string, multi: boolean) {
    // 「其他」选项特殊处理：选中时不清除其他选项，只是标记
    if (value === "__other__") {
      if (!multi) {
        setAnswers((prev) => ({ ...prev, [questionId]: "__other__" }));
      } else {
        setAnswers((prev) => {
          const cur = (prev[questionId] as string[]) || [];
          const next = cur.includes("__other__")
            ? cur
            : [...cur, "__other__"];
          return { ...prev, [questionId]: next };
        });
      }
      return;
    }

    setAnswers((prev) => {
      if (!multi) return { ...prev, [questionId]: value };
      const cur = (prev[questionId] as string[]) || [];
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      return { ...prev, [questionId]: next };
    });
  }

  function setOtherText(questionId: string, text: string) {
    setOtherValues((prev) => ({ ...prev, [questionId]: text }));
  }

  function submit() {
    const level = (answers.level as OnboardingProfile["level"]) || "novice";

    // 处理「其他」手填值：把 __other__ 替换为实际输入的文本
    function resolveOther(key: string): string[] {
      const raw = (answers[key] as string[]) || [];
      return raw
        .map((v) => (v === "__other__" ? otherValues[key]?.trim() || "其他" : v))
        .filter(Boolean);
    }

    const levelRaw = answers.level;
    const resolvedLevel: OnboardingProfile["level"] =
      levelRaw === "__other__"
        ? "beginner" // 手填基础时默认 beginner
        : (levelRaw as OnboardingProfile["level"]) || "novice";

    const profile: OnboardingProfile = {
      level: resolvedLevel,
      tools: resolveOther("tools"),
      contentTypes: resolveOther("contentTypes"),
      platforms: resolveOther("platforms"),
      weeklyHours: (answers.weeklyHours as string) || "2小时以内",
      painPoints: resolveOther("painPoints"),
      style: (answers.style as string) || "严谨客观",
      audience: (answers.audience as string) || "泛大众",
    };
    saveProfile(profile);
    setAdvice(generateAdvice(profile));
  }

  const levelSet = !!answers.level;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> 新手摸底
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          先花 30 秒认识你
        </h1>
        <p className="mt-3 text-muted-foreground">
          我们根据你的剪辑基础，给出更对口的「特效」和「节奏」分析建议。
        </p>
      </div>

      {!advice ? (
        <Card className="mt-8">
          <CardContent className="space-y-7 p-6">
            {QUIZ.map((q) => {
              const current = answers[q.id];
              return (
                <div key={q.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">{q.title}</h2>
                    {q.multi && (
                      <span className="text-xs text-muted-foreground">可多选</span>
                    )}
                  </div>
                  {q.help && (
                    <p className="mb-2 text-xs text-muted-foreground">{q.help}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const selected = q.multi
                        ? ((current as string[]) || []).includes(opt.value)
                        : current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggle(q.id, opt.value, q.multi)}
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground/80 hover:border-primary/40"
                          )}
                        >
                          {selected && (
                            <Check className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                          )}
                          {opt.label}
                        </button>
                      );
                    })}
                    {/* 「其他」手填输入框 */}
                    {q.options.some((o) => o.isOther) &&
                      (q.multi
                        ? ((current as string[]) || []).includes("__other__")
                        : current === "__other__"
                      ) && (
                        <Input
                          placeholder="请填写你的方向…"
                          value={otherValues[q.id] || ""}
                          onChange={(e) => setOtherText(q.id, e.target.value)}
                          className="h-[34px] w-40 rounded-full border-primary/50 px-3 text-sm focus-visible:border-primary"
                        />
                      )}
                  </div>
                </div>
              );
            })}

            <Button
              onClick={submit}
              disabled={!levelSet}
              variant="gradient"
              size="lg"
              className="mt-2 w-full"
            >
              <Wand2 className="h-4 w-4" /> 生成我的专属建议
            </Button>
            {!levelSet && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                请先选择「剪辑基础」再继续
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-8 border-primary/30">
          <CardContent className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold leading-none">
                  军师给你支几招
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  看你的情况：{advice.levelLabel}
                </p>
              </div>
            </div>
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground/90">
              {advice.summary}
            </p>
            <ul className="mt-4 space-y-2.5">
              {advice.tips.map((t, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => {
                function resolveOther(key: string): string[] {
                  const raw = (answers[key] as string[]) || [];
                  return raw
                    .map((v) => (v === "__other__" ? otherValues[key]?.trim() || "其他" : v))
                    .filter(Boolean);
                }
                const levelRaw = answers.level;
                const profile: OnboardingProfile = {
                  level:
                    levelRaw === "__other__"
                      ? "beginner"
                      : (levelRaw as OnboardingProfile["level"]) || "novice",
                  tools: resolveOther("tools"),
                  contentTypes: resolveOther("contentTypes"),
                  platforms: resolveOther("platforms"),
                  weeklyHours: (answers.weeklyHours as string) || "2小时以内",
                  painPoints: resolveOther("painPoints"),
                  style: (answers.style as string) || "严谨客观",
                  audience: (answers.audience as string) || "泛大众",
                };
                onComplete(profile);
              }}
              variant="gradient"
              size="lg"
              className="mt-5 w-full"
            >
              开始分析我的视频 <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
