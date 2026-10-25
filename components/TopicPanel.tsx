"use client";

import { ArrowUpRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { startQuizAction } from "@/app/(app)/interview/actions";
import { Chip } from "@/components/Chip";
import { type NodeState, STATE_LABEL, StatusGlyph } from "@/components/StatusIcon";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";
import type { NodeStatus } from "@/progress/graph";
import { cn } from "@/lib/utils";

type RelatedLink = { title: string; href: string };
type RelatedTopic = { slug: string; title: string; state: NodeState; color?: string };

export type TopicPanelProps = {
  node: {
    id: string;
    slug: string;
    title: string;
    trackName: string;
    /** The track's colour, shown as a dot beside its name. */
    trackColor?: string;
    summary: string;
    points: string[];
    code: string;
    pitfall: string;
    docsUrl: string;
  };
  status: NodeStatus;
  onStatus: (status: NodeStatus) => void;
  related: {
    questions: (RelatedLink & { id: string })[];
    notes: RelatedLink[];
    prereqs: RelatedTopic[];
    /** Topics this one is a prerequisite of. */
    unlocks?: RelatedTopic[];
  };
  /** Disables the status chips while a change is being saved. */
  pending?: boolean;
  /** A failed status save, shown under the status chips. */
  error?: string | null;
  /** Where a related topic links to (selects it in the same graph). */
  topicHref?: (slug: string) => string;
  /** "panel" stacks everything in a narrow column; "full" sets the content beside a sidebar for a full-screen read. */
  variant?: "panel" | "full";
  /** Shown beside the title, e.g. a button that opens the full view. */
  action?: React.ReactNode;
};

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: "none", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "done", label: "Done" },
];

/** A js code block whose fence is longer than any backtick run inside the code, so the code can never close it. */
function fencedCode(code: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}js\n${code}\n${fence}`;
}

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const rowLinkClass =
  "-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:py-2.5";

function TopicLinks({ title, items, topicHref }: { title: string; items: RelatedTopic[]; topicHref: (slug: string) => string }) {
  return (
    <div className="grid gap-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="grid">
        {items.map((t) => (
          <li key={t.slug}>
            {/* replace: moving between topics shouldn't stack history entries the back button has to wade through. */}
            <Link href={topicHref(t.slug)} scroll={false} replace className={rowLinkClass}>
              <StatusGlyph state={t.state} color={t.color} />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{STATE_LABEL[t.state]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopicPanel({ node, status, onStatus, related, pending, error, topicHref = (s) => `?topic=${s}`, variant = "panel", action }: TopicPanelProps) {
  const [quizMessage, setQuizMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const full = variant === "full";
  const unlocks = related.unlocks ?? [];
  // The reader and the side panel can both be on the page, so each gets its own heading id.
  const headingId = `${full ? "reader-" : ""}topic-${node.slug}`;

  async function quizThese() {
    setStarting(true);
    setQuizMessage(null);
    try {
      // On success the action redirects into the new quiz; it only returns for an empty deck.
      const result = await startQuizAction({
        questionIds: related.questions.map((q) => q.id),
        mode: "all",
        bookIds: [],
        partKeys: [],
        size: null,
      });
      if (result?.empty) setQuizMessage("None of these questions are available right now.");
    } finally {
      setStarting(false);
    }
  }

  const heading = (
    <header className="flex items-start justify-between gap-3">
      <div className="grid min-w-0 gap-1.5">
        <h2 id={headingId} className={cn("font-semibold text-balance", full ? "text-3xl tracking-tight sm:text-4xl" : "text-xl")}>
          {node.title}
        </h2>
        {node.trackName && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {node.trackColor && <span aria-hidden className="size-2 rounded-full" style={{ background: node.trackColor }} />}
            {node.trackName}
          </p>
        )}
      </div>
      {action}
    </header>
  );

  const statusGroup = (
    <div className="grid gap-2">
      {full && <h3 className="text-sm font-semibold">Your progress</h3>}
      <div role="group" aria-label="Your status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Chip key={s.value} on={status === s.value} disabled={pending} onClick={() => onStatus(s.value)}>
            {s.label}
          </Chip>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );

  const body = (
    <>
      {node.summary && (
        <div className={cn(full && "max-w-[68ch] text-lg leading-relaxed")}>
          <Markdown source={node.summary} />
        </div>
      )}

      {node.points.length > 0 && (
        <ul className={cn("grid list-disc gap-1.5 pl-5 leading-relaxed marker:text-muted-foreground", full && "max-w-[68ch] gap-2")}>
          {node.points.map((point, i) => (
            <li key={i}>
              <Markdown source={point} inline />
            </li>
          ))}
        </ul>
      )}

      {node.code && <Markdown source={fencedCode(node.code)} />}

      {node.pitfall && (
        <aside
          aria-label="Common mistake"
          className="flex gap-3 rounded-lg border p-4 leading-relaxed"
          style={{
            borderColor: "color-mix(in oklch, var(--destructive) 35%, var(--border))",
            background: "color-mix(in oklch, var(--destructive) 7%, var(--card))",
          }}
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="font-medium">Common mistake</p>
            <p className="mt-1">{node.pitfall}</p>
          </div>
        </aside>
      )}

      {node.docsUrl && (
        <a
          href={node.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex w-fit items-center gap-1 text-sm underline underline-offset-2 ${linkClass}`}
        >
          Read the docs
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      )}
    </>
  );

  const relatedParts = (
    <>
      {related.prereqs.length > 0 && <TopicLinks title="Needed first" items={related.prereqs} topicHref={topicHref} />}
      {unlocks.length > 0 && <TopicLinks title="Unlocks" items={unlocks} topicHref={topicHref} />}

      {related.questions.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Interview questions ({related.questions.length})</h3>
            <Button size="sm" variant="outline" onClick={quizThese} disabled={starting}>
              Quiz these
            </Button>
          </div>
          {quizMessage && (
            <p role="status" className="text-sm text-muted-foreground">
              {quizMessage}
            </p>
          )}
          <ul className="grid gap-1.5 text-sm">
            {related.questions.map((q) => (
              <li key={q.id}>
                <Link href={q.href} className={linkClass}>
                  <Markdown source={q.title} inline insideLink />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {related.notes.length > 0 && (
        <div className="grid gap-1.5">
          <h3 className="text-sm font-semibold">Notes</h3>
          <ul className="grid gap-1.5 text-sm">
            {related.notes.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={linkClass}>
                  {n.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  const hasRelated = related.prereqs.length > 0 || unlocks.length > 0 || related.questions.length > 0 || related.notes.length > 0;

  // Every grid here uses one minmax(0, 1fr) column: with the default auto column a wide code block would
  // widen the whole column to its longest line instead of scrolling inside itself.
  if (full)
    return (
      // Narrow: heading, status, content, related in one column. Wide: heading over content on the left,
      // status over related in a sidebar, so the status controls sit near the top either way.
      <article
        aria-labelledby={headingId}
        className="grid grid-cols-[minmax(0,1fr)] content-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-x-12 xl:gap-x-16"
      >
        <div className="lg:col-start-1 lg:row-start-1">{heading}</div>
        <div className="lg:col-start-2 lg:row-start-1 lg:self-end">{statusGroup}</div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6 lg:col-start-1 lg:row-start-2">{body}</div>
        {hasRelated && (
          <aside
            aria-label="Related"
            className="grid grid-cols-[minmax(0,1fr)] content-start gap-8 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2 lg:self-start"
          >
            {relatedParts}
          </aside>
        )}
      </article>
    );

  return (
    <article aria-labelledby={headingId} className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {heading}
      {statusGroup}
      {body}
      {hasRelated && (
        <section aria-label="Related" className="grid grid-cols-[minmax(0,1fr)] gap-5 border-t border-border pt-5">
          {relatedParts}
        </section>
      )}
    </article>
  );
}
