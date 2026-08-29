import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/llm";
import { guardAiRequest } from "@/lib/ai-guard";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 反 AI 味 的硬约束
const NO_AI_FLAVOR = [
  "语言要像真实短视频创作者写给人看的：口语化、有网感、有具体场景和细节、有情绪起伏。",
  "严禁使用 AI 套话：'首先/其次/最后'、'总的来说'、'让我们一起'、'在这个快节奏的时代'、'不禁让人思考'、'赋能/闭环/痛点/抓手'等空词。",
  "要具体到'这个人/这个产品/这个场景'，不要写成任何产品都能套的模板。",
].join("\n");

// 最新短视频平台规则（算法/爆款逻辑）
const PLATFORM_RULES = [
  "【最新短视频平台规则】",
  "抖音/快手：前3秒决定初始流量池，完播率+点赞+评论+转发是权重；钩子要前置、信息密度高；标签精准；发布时间选午/晚高峰；热门BGM+口播字幕利于完播；竖屏、可用混剪/口播。",
  "小红书：封面+标题决定首屏点击率，标利多/清单/情绪共鸣；关键词布局；避免硬广。",
  "B站：知识密度、完播、弹幕互动；标题适度。",
  "视频号：社交推荐+完播，情绪/转发驱动。",
].join("\n");

function briefPrompt(input: any): string {
  return [
    "你是资深短视频操盘手。用户想做一个产品/赛道的短视频。请给一份【创作brief】（不是稿子，是和用户共创确认），用**人话、像跟用户约稿的人**。",
    "",
    `用户信息：赛道 ${input.domain}；产品 ${input.product}；目的 ${input.goal}；对标账号 ${input.benchmark}；风格喜好 ${input.style}；特殊要求 ${input.requirement}。`,
    PLATFORM_RULES,
    "请输出：",
    "1. 这条片子我打算这么做：{内容类型/开头钩子/结构/节奏}（结合上面平台规则，说明为什么）。",
    "2. 卖点/钩子怎么打：{基于产品的真实卖点，不吹空}",
    "3. 对标/语气/网感：{参考对标的调性}",
    "4. 需要你确认的 2-3 个问题：{让用户拍板关键选择}",
    NO_AI_FLAVOR,
  ].join("\n");
}

function draftPrompt(input: any): string {
  return [
    "你是能写出『能直接拿去拍』的爆款短视频编剧。基于下面的创作brief，写【产品级】文稿+分镜，JSON 输出。",
    "",
    `赛道 ${input.domain}；产品 ${input.product}；目的 ${input.goal}；对标 ${input.benchmark}；风格 ${input.style}；特殊要求 ${input.requirement}。`,
    PLATFORM_RULES,
    NO_AI_FLAVOR,
    "",
    "要求：",
    "- 开头3秒必须有钩子（结果前置/冲突/悬念/身份共鸣），能留住人；",
    "- 中段信息密度高，别注水；情绪有起伏；",
    "- 结尾有明确互动/转化引导（关注/评论/下单）；",
    "- 口播文稿是'能直接念给人听'的，像真实创作者的话；",
    "- 分镜具体到镜头（画面/字幕/旁白/时长/BGM/演法）。",
    "",
    '输出 JSON：{"script":"完整口播文稿","hooks":"开头钩子(前3秒)","cta":"结尾引导","tags":["#标签1","#标签2"],"storyboard":[{"i":1,"shot":"画面/景别","caption":"字幕","voice":"旁白","bgm":"BGM","sec":时长}]}',
  ].join("\n");
}

function roleReviewPrompt(role: string, draftStr: string, input: any): string {
  return [
    `你是短视频团队的【${role}】，用你的专业眼光审这份稿子。结合${PLATFORM_RULES}`,
    `产品：${input.product}；目的：${input.goal}。`,
    "审稿要专业、具体、有依据（结合平台规则/爆款逻辑），别空话。",
    "每一条意见要：{severity(高/中/低), problem(具体问题), why(为什么这样会不好/结合平台规则), how(怎么改)}。",
    "",
    `【稿子】${draftStr}`,
    "",
    '输出 JSON：{"verdict":"通过/需改","score":0-100,"strengths":["..."]}',
  ].join("\n");
}

function revisePrompt(input: any, draftStr: string, reviews: any[]): string {
  return [
    "你是首席编剧。请根据 4 个审稿角色的意见，把稿子改到'产品级'，JSON 输出。",
    `产品 ${input.product}；目的 ${input.goal}；对标 ${input.benchmark}。`,
    NO_AI_FLAVOR,
    "",
    `【原稿】${draftStr}`,
    "",
    "【审稿意见】",
    reviews.map((r) => `${r.role}：${JSON.stringify(r.review)}`).join("\n"),
    "",
    "改稿要点：按意见逐条改进（尤其'高'优先级）；保留对的地方；输出和原稿同结构 JSON。",
    '{"script":"...","hooks":"...","cta":"...","tags":[...],"storyboard":[{"i":1,"shot":"...","caption":"...","voice":"...","bgm":"...","sec":数字}]}',
  ].join("\n");
}

const ROLES = ["制片人", "导演", "编剧", "营销"];

export async function POST(req: NextRequest) {
  const g = await guardAiRequest(req, "creative");
  if (!g.ok) return g.res;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "为了您的体验，请先登录", code: "UN_AUTHED" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const input = {
    domain: String(b.domain || "").trim(),
    product: String(b.product || "").trim(),
    goal: String(b.goal || "").trim(),
    benchmark: String(b.benchmark || "").trim(),
    style: String(b.style || "").trim(),
    requirement: String(b.requirement || "").trim(),
  };
  if (!input.domain || !input.product) {
    return NextResponse.json({ error: "请至少填赛道和产品" }, { status: 400 });
  }

  try {
    // 1) 共创 brief（文本，人话反馈）
    const brief = await chat("deepseek", [{ role: "user", content: briefPrompt(input) }], { temperature: 0.7, maxTokens: 800, timeoutMs: 120000, task: "creation:brief" });
    // 2) 初稿（文稿+分镜，JSON）
    const draftStr = await chat("deepseek", [{ role: "user", content: draftPrompt(input) }], { json: true, temperature: 0.8, maxTokens: 2600, timeoutMs: 160000, task: "creation:draft" });
    const draft = tryParse(draftStr);
    // 3) 4 角色并行审稿
    const reviews = await Promise.all(
      ROLES.map(async (role) => {
        const r = await chat("deepseek", [{ role: "user", content: roleReviewPrompt(role, draftStr, input) }], { json: true, temperature: 0.5, maxTokens: 900, timeoutMs: 120000, task: "creation:review" });
        let review: any;
        try { review = JSON.parse(r); } catch { review = { verdict: "需改", score: 70, note: r.slice(0, 400) }; }
        return { role, review };
      })
    );
    // 4) 按意见修订终稿
    const finalStr = await chat("deepseek", [{ role: "user", content: revisePrompt(input, draftStr, reviews) }], { json: true, temperature: 0.7, maxTokens: 2600, timeoutMs: 160000, task: "creation:revise" });
    const final = tryParse(finalStr);
    return NextResponse.json({ brief, draft, reviews, final });
  } catch (e: any) {
    console.warn("[creation] 失败:", e?.message || e);
    return NextResponse.json({ error: "生成失败：" + (e?.message || "未知") }, { status: 500 });
  }
}

function tryParse(s: string): any {
  try { return JSON.parse(s); } catch { return { raw: s }; }
}
