import type { Metadata } from "next";
import { ReplicaStudio } from "@/components/replica-studio";

export const metadata: Metadata = {
  title: "爆款复刻助手 · 速构构",
  description: "按赛道套用验证过的爆款公式，一键生成标题、脚本与分镜。",
};

export default function ReplicatePage() {
  return <ReplicaStudio />;
}
