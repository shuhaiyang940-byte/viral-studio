import type { MetadataRoute } from "next";

const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/payment", "/profile", "/verify-email", "/reset-password", "/forgot-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
