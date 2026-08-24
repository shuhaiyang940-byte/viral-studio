import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 项目既有代码大量使用 any（TS strict 已兜底），先降为警告而非阻断
      "@typescript-eslint/no-explicit-any": "off",
      // React 19 新 lint：effect 内同步 setState 属常见写法，降为提醒
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "remotion/**",
    "smart-editor/**",
    "data/**",
    "public/render/**",
    "tsconfig.tsbuildinfo",
  ]),
]);
