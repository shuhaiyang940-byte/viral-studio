"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ChevronsDown, X } from "lucide-react";

function TeleprompterInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [title, setTitle] = React.useState("提词器");
  const [lines, setLines] = React.useState<string[]>([]);
  const [size, setSize] = React.useState(28);
  const [speed, setSpeed] = React.useState(60);
  const [auto, setAuto] = React.useState(true);
  const [err, setErr] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    fetch(`/api/teleprompter?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(true);
        else {
          setTitle(d.title || "提词器");
          setLines(d.lines || []);
        }
      })
      .catch(() => setErr(true));
  }, [token]);

  // 每秒上涨 speed/60 像素，模拟缓慢滚动
  React.useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      window.scrollBy({ top: speed / 10, behavior: "smooth" });
    }, 100);
    return () => clearInterval(id);
  }, [auto, speed]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-black/80 px-4 py-2 backdrop-blur">
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-2 text-[11px] text-white/70">
          <label className="flex items-center gap-1">字号</label>
          <input type="range" min={20} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-white" />
          <label className="flex items-center gap-1">速度</label>
          <input type="range" min={30} max={160} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-20 accent-white" />
          <button
            onClick={() => setAuto((v) => !v)}
            className={`rounded px-2 py-0.5 font-medium ${auto ? "bg-white/20" : "bg-white/10 opacity-60"}`}
          >
            {auto ? "暂停" : "滚动"}
          </button>
        </div>
      </div>

      <div className="px-6 pb-64 pt-20" style={{ fontSize: size }}>
        {err ? (
          <p className="text-white/60">提词内容已过期，请回原页面重新生成。</p>
        ) : lines.length === 0 ? (
          <p className="text-white/60">加载中…</p>
        ) : (
          <div className="space-y-7">
            {lines.map((l, i) => (
              <p key={i} className="leading-relaxed">
                {l}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="pointer-events-auto fixed bottom-4 right-4 rounded-full bg-white/20 p-2">
        <ChevronsDown className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function TeleprompterPage() {
  return (
    <Suspense fallback={null}>
      <TeleprompterInner />
    </Suspense>
  );
}
