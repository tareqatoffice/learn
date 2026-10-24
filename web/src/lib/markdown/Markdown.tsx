import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { rehypePlugins, remarkPlugins } from "./pipeline";

const plugins = [...rehypePlugins, rehypeHighlight] as React.ComponentProps<
  typeof ReactMarkdown
>["rehypePlugins"];

const unwrap = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const inlineComponents = { p: unwrap };
// Inside a link or button a nested <a> is invalid HTML (and hijacks the click), so links keep only their text.
const inLinkComponents = { p: unwrap, a: unwrap };

/**
 * Renders markdown. `inline` drops the paragraph wrapper for one-line text such as a question title;
 * `insideLink` (inline only) also renders links as plain text, for text placed inside a link or button.
 */
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
