import type { MetadataRoute } from "next";

const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

const PATHS = [
  "",
  "/analyze",
  "/library",
  "/find-peer",
  "/copywriting",
  "/formulas",
  "/replicate",
  "/storyboard",
  "/pricing",
  "/help",
  "/about",
  "/privacy",
  "/terms",
  "/login",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: new Date(),
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : 0.7,
  }));
}
