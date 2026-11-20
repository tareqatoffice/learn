import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

// Only the landing page is public; everything else needs sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: getSiteUrl().origin, changeFrequency: "monthly", priority: 1 }];
}
