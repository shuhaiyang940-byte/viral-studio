import { TrendingUp, Sparkles } from "lucide-react";
import { SAMPLE_REPORT } from "@/lib/mock-data";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const DIMENSIONS = [
  { key: "hook", label: "开头吸引力" },
  { key: "value", label: "内容价值" },
  { key: "emotion", label: "情绪感染" },
  { key: "interaction", label: "互动能力" },
] as const;

export function ReportPreview() {
  const r = SAMPLE_REPORT;
  return (
    <Card className="w-full max-w-sm overflow-hidden border-border/80 shadow-2xl shadow-primary/5">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="success" className="gap-1">
            <Sparkles className="h-3 w-3" /> AI 拆解完成
          </Badge>
          <span className="text-xs text-muted-foreground">{r.meta.platform}</span>
        </div>

        <p className="mb-4 line-clamp-2 text-sm font-medium leading-snug">
          {r.meta.title}
        </p>

        <div className="flex items-center gap-4">
          <ScoreRing value={r.score.overall} size={92} stroke={8} label="综合评分" />
          <div className="flex-1 space-y-2">
            {DIMENSIONS.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium tabular-nums">{r.score[d.key]}</span>
                </div>
                <Progress value={r.score[d.key]} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" /> 为什么火
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{r.section.whyHot[0]}</p>
        </div>

        <div className="mt-3 space-y-1.5">
          {r.section.titles.slice(0, 2).map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 text-primary">#{i + 1}</span>
              <span className="line-clamp-1 text-foreground/80">{t}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
