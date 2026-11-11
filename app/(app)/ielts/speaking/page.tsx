import Link from "next/link";
import { type HubOption, SpeakingHub } from "@/components/ielts/SpeakingHub";
import { listAttempts } from "@/ielts/speaking/attempts";
import { type Kind, pickQuestions } from "@/ielts/speaking/questions";
import { getAiConfig } from "@/lib/aiSettings";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";

export const metadata = buildMetadata({
  title: "IELTS Speaking practice",
  description: "Run a full IELTS Speaking mock or drill one part, then rate yourself and get an AI estimate.",
  path: "/ielts/speaking",
});

const OPTIONS: { kind: Kind; title: string; blurb: string }[] = [
  { kind: "mock", title: "Full mock", blurb: "Part 1, Part 2 and Part 3 in one go, about 15 minutes. Video on by default." },
  { kind: "part1", title: "Part 1 drill", blurb: "Short questions about familiar topics." },
  { kind: "part2", title: "Part 2 drill", blurb: "One minute to prepare, then talk for up to two minutes." },
  { kind: "part3", title: "Part 3 drill", blurb: "Longer discussion questions." },
];

export default async function IeltsSpeakingPage({ searchParams }: PageProps<"/ielts/speaking">) {
  const { start } = await searchParams;
  const user = await requireUser();
  await connectDb();
  // Only whether the coach is on reaches the page; the key never does.
  const [ai, recent, picks] = await Promise.all([
    getAiConfig(),
    listAttempts(user.userId, { limit: 10 }),
    Promise.all(OPTIONS.map((o) => pickQuestions(user.userId, o.kind))),
  ]);
  const options: HubOption[] = OPTIONS.map((o, i) => ({ ...o, exhausted: picks[i].exhausted }));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Speaking practice</h1>
        <Link
          href="/ielts"
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to IELTS
        </Link>
      </div>
      <SpeakingHub
        options={options}
        recent={recent}
        aiOn={ai.settings.active}
        storage={storageConfigured()}
        highlightMock={start === "mock"}
      />
    </div>
  );
}
