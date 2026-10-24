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

// Shared by the renderer and extractToc so heading ids and TOC anchors cannot drift.
// Sanitize runs before slug so ids are not prefixed with `user-content-`.
export const rehypePlugins = [rehypeRaw, [rehypeSanitize, schema], rehypeSlug] as const;
