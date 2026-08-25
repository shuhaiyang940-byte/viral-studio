"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Smartphone, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 手机扫码提词器：生成短链 + 二维码，手机扫码即可滚动提词 */
export function TeleprompterButton({
  title,
  lines,
  variant = "outline",
  className,
}: {
  title: string;
  lines: string[];
  variant?: "outline" | "default";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function gen() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teleprompter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, lines }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) {
        setError(d.error || "生成失败");
        return;
      }
      setUrl(d.url);
      const data = await QRCode.toDataURL(d.url, { width: 220, margin: 1 });
      setQr(data);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  function openModal() {
    setOpen(true);
    if (!url && lines.length) gen();
  }

  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={openModal} disabled={!lines.length} title="手机扫码，边拍边提词">
        <Smartphone className="h-3.5 w-3.5" /> 手机扫码提词器
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">手机扫码 · 边拍边提词</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 p-2">
            {error ? (
              <p className="text-center text-xs text-destructive">{error}</p>
            ) : !qr ? (
              <div className="flex h-56 w-56 items-center justify-center text-xs text-muted-foreground">
                <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> 正在生成…
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="扫码进入提词器" className="h-56 w-56 rounded-lg border border-border" />
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} 复制链接
                  </Button>
                  <Button size="sm" className="flex-1 gap-1" onClick={gen}>
                    <RefreshCw className="h-3.5 w-3.5" /> 刷新
                  </Button>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">用手机扫一扫，打开后会自动向下滚动，字号/速度可调。</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
