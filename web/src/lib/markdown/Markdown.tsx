import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { rehypePlugins, remarkPlugins } from "./pipeline";

const plugins = [...rehypePlugins, rehypeHighlight] as React.ComponentProps<
  typeof ReactMarkdown
>["rehypePlugins"];

const inlineComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

export function Markdown({ source, inline = false }: { source: string; inline?: boolean }) {
  const body = (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={plugins}
      components={inline ? inlineComponents : undefined}
    >
      {source}
    </ReactMarkdown>
  );
  return inline ? <span className="md-inline">{body}</span> : <div className="md">{body}</div>;
}
