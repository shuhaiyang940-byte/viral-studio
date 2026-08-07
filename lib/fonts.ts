// 版权字体库数据层
// 所有字体均可免费商用（Google Fonts 开源字体 / 各大厂与公益免费商用字体）。
// 两类：
//  - online=true（默认）：Google Fonts 字体，可在线预览 + 一键下载 woff2。
//  - online=false：清单里的其他免费商用字体（阿里/站酷/庞门正道/霞鹜…），
//    无通用 CDN，预览以系统字体占位，需从官网/搜索下载安装后，在剪辑器内套用。

/** 风格分类（一级筛选） */
export type FontCat =
  | "黑体"
  | "宋体/衬线"
  | "手写"
  | "圆体"
  | "创意"
  | "数字"
  | "西文";

/** 使用场景标签（二级多选筛选，一个字体可挂多个） */
export type FontTag =
  | "字幕"
  | "封面"
  | "重点词"
  | "国风"
  | "可爱"
  | "手写"
  | "科技"
  | "文艺"
  | "电商"
  | "综艺"
  | "极简";

export interface FontDef {
  id: string;
  name: string;
  family: string;
  cat: FontCat;
  style: string;
  tags: FontTag[];
  /** Google Fonts css2 查询串，仅 online 字体有效 */
  url: string;
  license: string;
  /** 官网 / 下载页（offline 字体指向官网或检索页） */
  page: string;
  /** 是否可从 Google Fonts 在线预览与下载 woff2，默认 true */
  online?: boolean;
}

/** 风格分类筛选条 */
export const FONT_CATS: string[] = [
  "全部",
  "黑体",
  "宋体/衬线",
  "手写",
  "圆体",
  "创意",
  "数字",
  "西文",
];

/** 使用场景标签（多选） */
export const FONT_TAGS: FontTag[] = [
  "字幕",
  "封面",
  "重点词",
  "国风",
  "可爱",
  "手写",
  "科技",
  "文艺",
  "电商",
  "综艺",
  "极简",
];

/* ------------------------------------------------------------------ *
 * 在线字体（Google Fonts，可预览 + 下载 woff2）
 * ------------------------------------------------------------------ */
const ONLINE: FontDef[] = [
  { id: "fn1", name: "思源黑体", family: "'Noto Sans SC', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "重点词", "极简", "电商"], url: "Noto+Sans+SC:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Sans+SC" },
  { id: "fn2", name: "思源宋体", family: "'Noto Serif SC', serif", cat: "宋体/衬线", style: "宋体", tags: ["封面", "文艺", "国风"], url: "Noto+Serif+SC:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Serif+SC" },
  { id: "fn3", name: "站酷快乐体", family: "'ZCOOL KuaiLe', cursive", cat: "创意", style: "圆体", tags: ["可爱", "综艺", "封面"], url: "ZCOOL+KuaiLe", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/ZCOOL+KuaiLe" },
  { id: "fn4", name: "站酷小薇", family: "'ZCOOL XiaoWei', serif", cat: "宋体/衬线", style: "细衬线", tags: ["文艺", "国风", "封面"], url: "ZCOOL+XiaoWei", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/ZCOOL+XiaoWei" },
  { id: "fn5", name: "龙藏体", family: "'Long Cang', cursive", cat: "手写", style: "手写", tags: ["手写", "国风"], url: "Long+Cang", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Long+Cang" },
  { id: "fn6", name: "马善政毛笔", family: "'Ma Shan Zheng', cursive", cat: "手写", style: "毛笔楷", tags: ["手写", "国风", "封面"], url: "Ma+Shan+Zheng", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Ma+Shan+Zheng" },
  { id: "fn7", name: "志莽行书", family: "'Zhi Mang Xing', cursive", cat: "手写", style: "行书", tags: ["手写", "国风"], url: "Zhi+Mang+Xing", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Zhi+Mang+Xing" },
  { id: "fn8", name: "刘建毛草", family: "'Liu Jian Mao Cao', cursive", cat: "手写", style: "草书", tags: ["手写", "国风"], url: "Liu+Jian+Mao+Cao", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Liu+Jian+Mao+Cao" },
  { id: "fn9", name: "站酷庆科黄油体", family: "'ZCOOL QingKe HuangYou', cursive", cat: "创意", style: "美术", tags: ["封面", "综艺", "重点词"], url: "ZCOOL+QingKe+HuangYou", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/ZCOOL+QingKe+HuangYou" },
  { id: "fn10", name: "思源黑体 HK", family: "'Noto Sans HK', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "重点词", "极简"], url: "Noto+Sans+HK:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Sans+HK" },
  { id: "fn11", name: "思源宋体 TC", family: "'Noto Serif TC', serif", cat: "宋体/衬线", style: "宋体", tags: ["封面", "文艺", "国风"], url: "Noto+Serif+TC:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Serif+TC" },
  { id: "fn12", name: "思源黑体 TC", family: "'Noto Sans TC', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "重点词", "极简"], url: "Noto+Sans+TC:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Sans+TC" },
  { id: "fn13", name: "思源黑体 JP", family: "'Noto Sans JP', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "重点词", "极简"], url: "Noto+Sans+JP:wght@400;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Noto+Sans+JP" },
  { id: "fn14", name: "奥斯瓦德", family: "'Oswald', sans-serif", cat: "西文", style: "窄标题", tags: ["封面", "重点词", "电商", "科技"], url: "Oswald:wght@500;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Oswald" },
  { id: "fn15", name: "比巴斯数字", family: "'Bebas Neue', sans-serif", cat: "数字", style: "窄数字", tags: ["重点词", "封面", "电商"], url: "Bebas+Neue", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Bebas+Neue" },
  { id: "fn16", name: "安东超粗", family: "'Anton', sans-serif", cat: "西文", style: "超粗", tags: ["封面", "重点词", "综艺"], url: "Anton", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Anton" },
  { id: "fn17", name: "太平洋手写", family: "'Pacifico', cursive", cat: "西文", style: "手写", tags: ["手写", "可爱"], url: "Pacifico", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Pacifico" },
  { id: "fn18", name: "龙虾手写", family: "'Lobster', cursive", cat: "西文", style: "手写", tags: ["手写", "封面"], url: "Lobster", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Lobster" },
  { id: "fn19", name: "轨道科技数字", family: "'Orbitron', sans-serif", cat: "数字", style: "科技", tags: ["科技", "封面", "重点词"], url: "Orbitron:wght@500;700", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Orbitron" },
  { id: "fn20", name: "像素数字", family: "'Press Start 2P', monospace", cat: "数字", style: "像素", tags: ["科技", "综艺", "重点词"], url: "Press+Start+2P", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Press+Start+2P" },
  { id: "fn21", name: "爆炸漫画体", family: "'Bangers', cursive", cat: "西文", style: "漫画", tags: ["综艺", "封面", "重点词"], url: "Bangers", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Bangers" },
  { id: "fn22", name: "随性手书", family: "'Caveat', cursive", cat: "西文", style: "手书", tags: ["手写", "文艺"], url: "Caveat:wght@600", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Caveat" },
  { id: "fn23", name: "几何展示体", family: "'Righteous', cursive", cat: "西文", style: "几何", tags: ["封面", "重点词", "综艺"], url: "Righteous", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Righteous" },
  { id: "fn24", name: "巴鲁圆体", family: "'Baloo 2', cursive", cat: "西文", style: "圆体", tags: ["可爱", "字幕", "电商"], url: "Baloo+2:wght@600", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Baloo+2" },
  { id: "fn25", name: "等宽数字", family: "'JetBrains Mono', monospace", cat: "数字", style: "等宽", tags: ["科技", "重点词"], url: "JetBrains+Mono:wght@500", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/JetBrains+Mono" },
  { id: "fn26", name: "蒙纳现代体", family: "'Montserrat', sans-serif", cat: "西文", style: "现代", tags: ["电商", "极简", "封面"], url: "Montserrat:wght@600;800", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Montserrat" },
  { id: "fn27", name: "装甲方块体", family: "'Russo One', sans-serif", cat: "西文", style: "方块", tags: ["科技", "重点词", "封面"], url: "Russo+One", license: "Google Fonts · 免费商用", page: "https://fonts.google.com/specimen/Russo+One" },
];

/* ------------------------------------------------------------------ *
 * 离线字体（来自「免费商用字体清单」，需官网/搜索下载安装）
 * 预览以系统字体占位，真实效果在安装后于剪辑器内可见。
 * ------------------------------------------------------------------ */
function searchPage(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(name + " 免费商用 字体 下载")}`;
}

const OFFLINE: FontDef[] = [
  { id: "of1", name: "阿里巴巴普惠体", family: "'Alibaba PuHuiTi', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "重点词", "电商", "极简"], url: "", license: "免费商用声明", page: "https://alibabafont.taobao.com/", online: false },
  { id: "of2", name: "得意黑 Smiley Sans", family: "'Smiley Sans', sans-serif", cat: "创意", style: "黑体/创意", tags: ["封面", "重点词", "科技", "极简"], url: "", license: "SIL OFL 1.1", page: "https://github.com/atelier-anchor/smiley-sans", online: false },
  { id: "of3", name: "霞鹜文楷", family: "'Lxgw WenKai', serif", cat: "手写", style: "楷体", tags: ["文艺", "国风", "字幕"], url: "", license: "SIL OFL 1.1", page: "https://github.com/lxgw/LxgwWenKai", online: false },
  { id: "of4", name: "站酷高端黑", family: "'ZCOOL GaoDuanHei', sans-serif", cat: "黑体", style: "黑体标题", tags: ["封面", "重点词", "综艺"], url: "", license: "免费商用声明", page: searchPage("站酷高端黑"), online: false },
  { id: "of5", name: "站酷酷黑", family: "'ZCOOL KuHei', sans-serif", cat: "黑体", style: "黑体标题", tags: ["封面", "重点词", "综艺"], url: "", license: "免费商用声明", page: searchPage("站酷酷黑"), online: false },
  { id: "of6", name: "优设标题黑", family: "'YS Title Hei', sans-serif", cat: "黑体", style: "黑体标题", tags: ["封面", "重点词", "综艺"], url: "", license: "免费商用声明", page: searchPage("优设标题黑"), online: false },
  { id: "of7", name: "优设好身体", family: "'YS HaoShenTi', sans-serif", cat: "圆体", style: "圆体", tags: ["可爱", "电商", "字幕"], url: "", license: "免费商用声明", page: searchPage("优设好身体"), online: false },
  { id: "of8", name: "阿里妈妈东方大楷", family: "'Alimama DongFangDaKai', serif", cat: "手写", style: "楷书", tags: ["国风", "手写", "封面"], url: "", license: "免费商用声明", page: searchPage("阿里妈妈东方大楷"), online: false },
  { id: "of9", name: "庞门正道真贵楷体", family: "'PangMen ZhengDao GuiKai', serif", cat: "手写", style: "楷书", tags: ["国风", "手写", "文艺"], url: "", license: "免费商用声明", page: searchPage("庞门正道真贵楷体"), online: false },
  { id: "of10", name: "演示镇魂行楷", family: "'YanShi ZhenHunXingKai', serif", cat: "手写", style: "行楷", tags: ["国风", "手写", "封面"], url: "", license: "免费商用声明", page: searchPage("演示镇魂行楷"), online: false },
  { id: "of11", name: "庞门正道粗书体", family: "'PangMen ZhengDao CuShu', serif", cat: "手写", style: "书法", tags: ["国风", "手写", "封面"], url: "", license: "免费商用声明", page: searchPage("庞门正道粗书体"), online: false },
  { id: "of12", name: "胡晓波手写体", family: "'HuXiaoBo ShouXie', cursive", cat: "手写", style: "手写", tags: ["手写", "文艺"], url: "", license: "免费商用声明", page: searchPage("胡晓波手写体"), online: false },
  { id: "of13", name: "江西拙楷", family: "'JiangXi ZhuoKai', serif", cat: "手写", style: "楷书", tags: ["手写", "国风", "文艺"], url: "", license: "免费商用声明", page: searchPage("江西拙楷"), online: false },
  { id: "of14", name: "沐瑶随心手写体", family: "'MuYao SuiXin', cursive", cat: "手写", style: "手写", tags: ["手写", "可爱", "文艺"], url: "", license: "免费商用声明", page: searchPage("沐瑶随心手写体"), online: false },
  { id: "of15", name: "鸿雷行书简体", family: "'HongLei XingShu', serif", cat: "手写", style: "行书", tags: ["手写", "国风"], url: "", license: "免费商用声明", page: searchPage("鸿雷行书简体"), online: false },
  { id: "of16", name: "钟齐流江毛草", family: "'ZhongQi LiuJiangMaoCao', cursive", cat: "手写", style: "草书", tags: ["手写", "国风"], url: "", license: "免费商用声明", page: searchPage("钟齐流江毛草"), online: false },
  { id: "of17", name: "问藏书房体", family: "'WenCang ShuFang', sans-serif", cat: "创意", style: "极简古风", tags: ["国风", "极简", "文艺"], url: "", license: "免费商用声明", page: searchPage("问藏书房体"), online: false },
  { id: "of18", name: "贤二体", family: "'XianEr Ti', cursive", cat: "创意", style: "憨萌", tags: ["可爱", "手写", "综艺"], url: "", license: "免费商用声明", page: searchPage("贤二体"), online: false },
  { id: "of19", name: "包图小白体", family: "'BaoTu XiaoBai', sans-serif", cat: "黑体", style: "清爽可爱", tags: ["可爱", "字幕", "电商"], url: "", license: "免费商用声明", page: searchPage("包图小白体"), online: false },
  { id: "of20", name: "抖音美好体", family: "'Douyin MeiHao', sans-serif", cat: "黑体", style: "品牌", tags: ["综艺", "电商", "封面"], url: "", license: "免费商用声明", page: searchPage("抖音美好体"), online: false },
  { id: "of21", name: "OPPO Sans", family: "'OPPO Sans', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "极简", "电商"], url: "", license: "免费商用声明", page: searchPage("OPPO Sans"), online: false },
  { id: "of22", name: "MiSans", family: "'MiSans', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "极简", "电商"], url: "", license: "免费商用声明", page: searchPage("MiSans"), online: false },
  { id: "of23", name: "HarmonyOS Sans", family: "'HarmonyOS Sans', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "极简", "电商"], url: "", license: "免费商用声明", page: searchPage("HarmonyOS Sans"), online: false },
  { id: "of24", name: "联想小新潮酷体", family: "'Lenovo Xiaoxin', sans-serif", cat: "创意", style: "创意黑体", tags: ["封面", "综艺", "科技"], url: "", license: "免费商用声明", page: searchPage("联想小新潮酷体"), online: false },
  { id: "of25", name: "阿里妈妈刀隶体", family: "'Alimama DaoLi', serif", cat: "手写", style: "隶书", tags: ["国风", "封面"], url: "", license: "免费商用声明", page: searchPage("阿里妈妈刀隶体"), online: false },
  { id: "of26", name: "仓耳周珂正大榜书", family: "'CangEr ZhouKe BangShu', serif", cat: "创意", style: "榜书标题", tags: ["封面", "重点词"], url: "", license: "免费商用声明", page: searchPage("仓耳周珂正大榜书"), online: false },
  { id: "of27", name: "金画字", family: "'JinHua Zi', sans-serif", cat: "创意", style: "45°标题", tags: ["封面", "重点词", "综艺"], url: "", license: "免费商用声明", page: searchPage("金画字"), online: false },
  { id: "of28", name: "庞门正道轻松体", family: "'PangMen ZhengDao QingSong', sans-serif", cat: "黑体", style: "黑体", tags: ["字幕", "电商", "极简"], url: "", license: "免费商用声明", page: searchPage("庞门正道轻松体"), online: false },
];

export const FONT_LIBRARY: FontDef[] = [...ONLINE, ...OFFLINE];

/** 触发浏览器下载某个字体的 woff2 文件（仅 online 字体；offline 走官网/搜索） */
export async function downloadFontFile(f: FontDef): Promise<{ ok: boolean; fallback?: string }> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${f.url}&display=swap`;
    const cssRes = await fetch(cssUrl, { headers: { "User-Agent": navigator.userAgent } });
    const css = await cssRes.text();
    const matches = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)];
    const woff2 = matches.length ? matches[matches.length - 1][1] : null;
    if (!woff2) return { ok: false, fallback: f.page };
    const fontRes = await fetch(woff2);
    const blob = await fontRes.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${f.name.replace(/\s+/g, "_")}.woff2`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true };
  } catch {
    return { ok: false, fallback: f.page };
  }
}
