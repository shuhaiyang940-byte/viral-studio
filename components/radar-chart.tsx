import { cn } from "@/lib/utils";

interface RadarChartProps {
  data: { label: string; value: number }[];
  size?: number;
  className?: string;
}

export function RadarChart({ data, size = 160, className }: RadarChartProps) {
  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size / 2) * 0.7;

  // 计算多边形顶点
  function point(index: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * maxR;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // 背景网格（5层）
  const levels = [20, 40, 60, 80, 100];
  const gridPaths = levels.map((lv) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = point(i, lv);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  });

  // 数据区域
  const dataPoints: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = point(i, data[i].value);
    dataPoints.push(`${x},${y}`);
  }

  // 标签位置
  const labels = data.map((d, i) => {
    const [x, y] = point(i, 115);
    return { x, y, text: d.label };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn("overflow-visible", className)}
    >
      {/* 网格 */}
      {gridPaths.map((p, i) => (
        <polygon
          key={i}
          points={p}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={0.5}
        />
      ))}
      {/* 轴线 */}
      {data.map((_, i) => {
        const [x, y] = point(i, 100);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={0.5} />
        );
      })}
      {/* 数据填充 */}
      <polygon
        points={dataPoints.join(" ")}
        fill="hsl(263 70% 66% / 0.15)"
        stroke="hsl(263 70% 66%)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* 数据点 */}
      {data.map((d, i) => {
        const [x, y] = point(i, d.value);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="hsl(263 70% 66%)" />;
      })}
      {/* 标签 */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="hsl(var(--muted-foreground))"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}
