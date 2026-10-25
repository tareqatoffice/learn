import type { Metadata } from "next";

export const SITE_NAME = "Learn";
export const SITE_DESCRIPTION =
  "A personal learning platform: interview question books with spaced review, prerequisite topic graphs, and chaptered study notes.";

/** Absolute origin for canonical and Open Graph URLs. Set NEXT_PUBLIC_SITE_URL in production. */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return new URL(
    explicit || (vercel ? `https://${vercel}` : "http://localhost:3000"),
  );
}

const MAX_DESCRIPTION = 160;

/** Collapses markdown/whitespace to one plain line and trims it to a search-snippet length. */
export function toDescription(
  source: string | undefined | null,
  fallback = SITE_DESCRIPTION,
): string {
  const plain = (source ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return fallback;
  if (plain.length <= MAX_DESCRIPTION) return plain;
  return `${plain.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, "")}…`;
}

type PageSeo = {
  /** Page title only; the root layout's template appends " · Learn". */
  title: string;
  description?: string | null;
  /** Site-relative path, e.g. "/notes/react". Becomes the canonical URL and og:url. */
  path: string;
  /** Keep the page out of search results. Use for signed-in and admin pages. */
  noindex?: boolean;
};

/** One place that sets title, description, canonical, Open Graph, Twitter and robots for a page. */
export function buildMetadata({
  title,
  description,
  path,
  noindex = false,
}: PageSeo): Metadata {
  const summary = toDescription(description);
  return {
    title,
    description: summary,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: summary,
      url: path,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: { card: "summary", title, description: summary },
    ...(noindex && { robots: { index: false, follow: false } }),
  };
}
