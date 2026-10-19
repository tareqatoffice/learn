"use client";

import Link from "next/link";
import { useState } from "react";
import { startQuizAction } from "@/app/(app)/interview/actions";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown/Markdown";
import type { NodeStatus } from "@/progress/graph";

type RelatedLink = { title: string; href: string };

export type TopicPanelProps = {
  node: {
    id: string;
    slug: string;
    title: string;
    trackName: string;
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
    prereqs: { slug: string; title: string; status: NodeStatus }[];
  };
  /** Disables the status chips while a change is being saved. */
  pending?: boolean;
  /** Where a prerequisite links to (selects it in the same graph). */
  topicHref?: (slug: string) => string;
};

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: "none", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "done", label: "Done" },
];

const STATUS_LABEL: Record<NodeStatus, string> = { none: "not started", learning: "learning", done: "done" };

const linkClass = "hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function TopicPanel({ node, status, onStatus, related, pending, topicHref = (s) => `?topic=${s}` }: TopicPanelProps) {
  const [quizMessage, setQuizMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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

  return (
    <article aria-labelledby={`topic-${node.slug}`} className="grid gap-4">
      <header className="grid gap-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{node.trackName}</p>
        <h2 id={`topic-${node.slug}`} className="text-xl font-semibold">
          {node.title}
        </h2>
      </header>

      <div role="group" aria-label="Your status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Chip key={s.value} on={status === s.value} disabled={pending} onClick={() => onStatus(s.value)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {node.summary && <Markdown source={node.summary} />}

      {node.points.length > 0 && (
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {node.points.map((point, i) => (
            <li key={i}>
              <Markdown source={point} inline />
            </li>
          ))}
        </ul>
      )}

      {node.code && <Markdown source={`\`\`\`js\n${node.code}\n\`\`\``} />}

      {node.pitfall && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
          <p className="font-medium">Common mistake</p>
          <p className="mt-1">{node.pitfall}</p>
        </div>
      )}

      {node.docsUrl && (
        <a href={node.docsUrl} target="_blank" rel="noopener noreferrer" className={`text-sm underline underline-offset-2 ${linkClass}`}>
          Read the docs ↗
        </a>
      )}

      {(related.questions.length > 0 || related.notes.length > 0 || related.prereqs.length > 0) && (
        <section aria-label="Related" className="grid gap-3 border-t border-border pt-4">
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
              <ul className="grid gap-1 text-sm">
                {related.questions.map((q) => (
                  <li key={q.id}>
                    <Link href={q.href} className={linkClass}>
                      <Markdown source={q.title} inline />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {related.notes.length > 0 && (
            <div className="grid gap-1">
              <h3 className="text-sm font-semibold">Notes</h3>
              <ul className="grid gap-1 text-sm">
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

          {related.prereqs.length > 0 && (
            <div className="grid gap-1">
              <h3 className="text-sm font-semibold">Needed first</h3>
              <ul className="grid gap-1 text-sm">
                {related.prereqs.map((p) => (
                  <li key={p.slug} className="flex items-center justify-between gap-2">
                    <Link href={topicHref(p.slug)} scroll={false} className={linkClass}>
                      {p.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{STATUS_LABEL[p.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
