import * as React from "react";
import type { StoryboardShot, ShotAngle } from "@/lib/types";

const ACCENT = "#6366f1";
const ACCENT2 = "#f59e0b";

function figure(cx: number, groundY: number, s: number, name: string, key: string) {
  return (
    <g key={key}>
      <circle cx={cx} cy={groundY - 44 * s} r={9 * s} fill="none" stroke={ACCENT} strokeWidth={2} />
      <line x1={cx} y1={groundY - 35 * s} x2={cx} y2={groundY - 14 * s} stroke={ACCENT} strokeWidth={2} />
      <line x1={cx} y1={groundY - 14 * s} x2={cx - 7 * s} y2={groundY} stroke={ACCENT} strokeWidth={2} />
      <line x1={cx} y1={groundY - 14 * s} x2={cx + 7 * s} y2={groundY} stroke={ACCENT} strokeWidth={2} />
      <line x1={cx} y1={groundY - 28 * s} x2={cx - 10 * s} y2={groundY - 20 * s} stroke={ACCENT} strokeWidth={2} />
      <line x1={cx} y1={groundY - 28 * s} x2={cx + 10 * s} y2={groundY - 20 * s} stroke={ACCENT} strokeWidth={2} />
      <text x={cx} y={groundY + 13} fontSize={9} fill="currentColor" textAnchor="middle">
        {name.length > 6 ? name.slice(0, 6) + "…" : name}
      </text>
    </g>
  );
}

function cameraArrow(angle: ShotAngle, groundY: number) {
  const labelMap: Record<ShotAngle, string> = {
    close: "特写",
    eye: "主观",
    high: "俯拍",
    low: "仰拍",
    pan: "横移",
    wide: "远景",
  };
  let line: [number, number, number, number] = [160, 196, 160, 172];
  let color = ACCENT2;
  switch (angle) {
    case "close":
      line = [298, groundY - 40, 252, groundY - 40];
      color = "#ef4444";
      break;
    case "eye":
      line = [160, 196, 160, 172];
      break;
    case "high":
      line = [160, 6, 160, 30];
      color = "#0ea5e9";
      break;
    case "low":
      line = [80, 196, 110, 172];
      color = "#10b981";
      break;
    case "pan":
      line = [42, groundY - 70, 278, groundY - 70];
      color = "#a855f7";
      break;
    case "wide":
      line = [30, 18, 92, 86];
      color = "#64748b";
      break;
  }
  return (
    <g>
      <defs>
        <marker id={`arw-${angle}`} markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={color} />
        </marker>
      </defs>
      <line
        x1={line[0]}
        y1={line[1]}
        x2={line[2]}
        y2={line[3]}
        stroke={color}
        strokeWidth={3}
        markerEnd={`url(#arw-${angle})`}
      />
      <text x={line[2]} y={line[3] - 6} fontSize={10} fontWeight={700} fill={color} textAnchor="middle">
        {labelMap[angle]}
      </text>
    </g>
  );
}

/** 单镜头简易分镜示意图：场景框 + 人物站位 + 运镜方向箭头 */
export function ShotDiagram({ shot }: { shot: StoryboardShot }) {
  const groundY = 158;
  const positions: number[] =
    shot.layout === "single"
      ? [160]
      : shot.layout === "duo"
        ? [118, 202]
        : [92, 160, 228];
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label={`分镜示意图：${shot.scene}`}>
      <rect x={36} y={14} width={248} height={150} rx={8} fill="rgba(99,102,241,0.06)" stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />
      <line x1={36} y1={groundY} x2={284} y2={groundY} stroke="rgba(148,163,184,0.35)" strokeWidth={1} strokeDasharray="3 3" />
      {positions.map((cx, i) => figure(cx, groundY, 1, shot.characters[i] ?? "人物", `f${i}`))}
      {cameraArrow(shot.angle, groundY)}
    </svg>
  );
}
