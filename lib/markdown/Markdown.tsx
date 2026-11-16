import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { rehypePlugins, remarkPlugins } from "./pipeline";

const plugins = [...rehypePlugins, rehypeHighlight] as React.ComponentProps<
  typeof ReactMarkdown
>["rehypePlugins"];

const unwrap = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const inlineComponents = { p: unwrap };
const inLinkComponents = { p: unwrap, a: unwrap };

export function Markdown({ source, inline = false, insideLink = false }: { source: string; inline?: boolean; insideLink?: boolean }) {
  const body = (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={plugins}
      components={inline ? (insideLink ? inLinkComponents : inlineComponents) : undefined}
    >
      {source}
    </ReactMarkdown>
  );
  return inline ? <span className="md-inline">{body}</span> : <div className="md">{body}</div>;
}
