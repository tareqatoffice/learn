import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

const schema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "kbd"],
};

export const remarkPlugins = [remarkGfm];

export const HEADING_PREFIX = "h-";
export const headingId = (anchor: string) => `${HEADING_PREFIX}${anchor}`;

export const rehypePlugins = [rehypeRaw, [rehypeSanitize, schema], [rehypeSlug, { prefix: HEADING_PREFIX }]] as const;
