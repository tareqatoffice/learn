import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

// Default schema keeps `a`, `br`, `sup`, `sub` and `language-*` classes on `code`.
const schema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary", "kbd"],
};

// Sanitize runs before slug so heading ids are not prefixed with `user-content-`.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [
  rehypeRaw,
  [rehypeSanitize, schema],
  rehypeSlug,
  rehypeHighlight,
] as React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"];

const inlineComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

export function Markdown({ source, inline = false }: { source: string; inline?: boolean }) {
  const body = (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={inline ? inlineComponents : undefined}
    >
      {source}
    </ReactMarkdown>
  );
  return inline ? <span className="md-inline">{body}</span> : <div className="md">{body}</div>;
}
