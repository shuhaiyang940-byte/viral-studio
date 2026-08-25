import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  no?: string;
  shot?: string;
  line?: string;
  cue?: string;
  sfx?: string;
}

interface Payload {
  title?: string;
  lines?: { text: string; mood?: string }[];
  rows?: Row[];
  notes?: string[];
  bgm?: string;
}

/**
 * 一键导出：POST { type:"txt"|"csv", payload }
 * → 返回可下载文件（txt 提词器 / csv 分镜表，Excel 可打开）。
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; payload?: Payload };
  const type = body.type;
  const p = body.payload || {};
  const title = (p.title || "爆款复刻").trim();

  if (type === "txt") {
    const lines = [
      `【${title}】提词器`,
      ...(p.lines || []).map((l, i) => `${String(i + 1).padStart(2, "0")}. ${l.text}`),
      "",
      ...(p.rows || []).map((r, i) =>
        `镜 ${r.no || String(i + 1).padStart(2, "0")}：${r.shot || ""}\n  ${r.line || ""}`
      ),
      "",
      ...(p.notes || []).map((n) => `避坑：${n}`),
      p.bgm ? `BGM：${p.bgm}` : "",
    ].filter(Boolean);
    const txt = lines.join("\n");
    return new Response(new Blob([txt], { type: "text/plain;charset=utf-8" }), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${title}-提词器.txt`)}`,
      },
    });
  }

  if (type === "csv") {
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const head = ["镜号", "景别与镜头动作", "口播文案（含停顿与语气）", "画面/道具提示", "音效/BGM建议"];
    const rows = (p.rows || []).map((r) =>
      [r.no, r.shot, r.line, r.cue, r.sfx].map((v) => esc(String(v || ""))).join(",")
    );
    // 加 UTF-8 BOM，避免 Excel 打开乱码
    const csv = "\uFEFF" + [head.map((h) => esc(h)).join(","), ...rows].join("\n");
    return new Response(new Blob([csv], { type: "text/csv;charset=utf-8" }), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${title}-分镜表.csv`)}`,
      },
    });
  }

  return NextResponse.json({ error: "未知的导出类型" }, { status: 400 });
}
