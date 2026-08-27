// Creative Fact Sheet：五个角色共享的唯一事实层。

import type { CreativeFactSheet, TaskType } from "./types";
import type { CreativeInput } from "./tasks";

export function buildFactSheet(input: CreativeInput, taskType: TaskType): CreativeFactSheet {
  const budget = input.budget ?? "";
  const time = input.time ?? "";
  const materials = input.materials ?? "";
  const constraints: string[] = [];
  if (/低|省|便宜|有限|少|控制/i.test(budget)) constraints.push("成本受限");
  if (/紧|短|快|一周|一天|小时/i.test(time)) constraints.push("时间紧张");
  if (!materials.trim()) constraints.push("暂无明确素材清单");

  return {
    taskType,
    goal: input.goal ?? "",
    platform: input.platform ?? "未指定",
    content_type: input.content_type ?? "通用",
    audience: input.audience ?? "未指定",
    budget,
    time,
    materials,
    analysis: {
      title: undefined,
      hookType: undefined,
    },
    constraints,
    questions: [],
  };
}
