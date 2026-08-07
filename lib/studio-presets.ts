// 剪辑台视觉预设：页面预览与成片导出共用，避免两套实现漂移。
export const GRADE_CSS: Record<string, string> = {
  c1: "none", c2: "saturate(1.15) brightness(1.05)", c3: "contrast(1.1) saturate(0.9) brightness(0.95)",
  c4: "sepia(0.25) saturate(1.2) brightness(1.05)", c5: "hue-rotate(180deg) saturate(1.1) brightness(0.95)",
  c6: "grayscale(1)", c7: "sepia(0.4) contrast(1.05) saturate(0.85)", c8: "contrast(1.2) saturate(1.4) hue-rotate(-20deg)",
};
export const FILTER_TINT: Record<string, string> = {
  f1: "rgba(254,243,226,0.28)", f2: "rgba(252,228,236,0.28)", f3: "rgba(215,204,200,0.32)",
  f4: "rgba(26,26,46,0.30)", f5: "rgba(33,33,33,0.30)", f6: "rgba(200,180,174,0.28)",
};
export const EFFECT_STYLE: Record<string, { filter?: string; transform?: string; boxShadow?: string }> = {
  e1: { boxShadow: "0 0 24px 4px rgba(255,255,255,0.6)" },
  e2: { filter: "contrast(1.25) saturate(1.4)", transform: "translateX(1px)" },
  e3: { filter: "blur(0.6px)" },
  e4: { filter: "drop-shadow(0 0 2px rgba(0,0,0,0.4))" },
  e5: { transform: "scale(1.03)" },
  e6: { filter: "drop-shadow(2px 0 rgba(255,0,80,0.7)) drop-shadow(-2px 0 rgba(0,200,255,0.7))" },
  e7: { filter: "sepia(0.5) contrast(0.9) brightness(0.9)" },
  e8: { filter: "drop-shadow(0 0 10px currentColor)" },
};
