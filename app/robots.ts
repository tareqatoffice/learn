import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().origin;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/access"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
