import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

// Default schema keeps `a`, `br`, `sup`, `sub` and `language-*` classes on `code`.
const schema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "kbd"],
};

export const remarkPlugins = [remarkGfm];

/**
 * Heading ids are prefixed so a heading such as "Main" or "Notes" can't take an id the page already
 * uses. Stored anchors (Note.toc, topic links) stay the plain slug; links go through `headingId`.
 */
export const HEADING_PREFIX = "h-";
export const headingId = (anchor: string) => `${HEADING_PREFIX}${anchor}`;

// Shared by the renderer and extractToc so heading ids and TOC anchors cannot drift.
// Sanitize runs before slug so ids are not prefixed with `user-content-`.
export const rehypePlugins = [rehypeRaw, [rehypeSanitize, schema], [rehypeSlug, { prefix: HEADING_PREFIX }]] as const;
