import Link from "next/link";
import { type AdminIeltsItem, type ItemType, listItemsAdmin } from "@/admin/ielts";
import { AdminList, AdminListItem, AdminPage, AdminSection } from "@/components/admin/layout";
import { IeltsGenerateDraftButton } from "@/components/admin/IeltsGenerateDraftButton";
import { IeltsItemStatusButton } from "@/components/admin/IeltsItemStatusButton";
import { buttonVariants } from "@/components/ui/button";
import { getAiConfig } from "@/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "IELTS Speaking · Admin",
  description: "Manage the IELTS Speaking question bank: Part 1 topics, Part 2 cue cards and Part 3 discussions.",
  path: "/admin/ielts/speaking",
});

const SECTIONS: { type: ItemType; title: string; description: string; empty: string; add: string }[] = [
  { type: "part1", title: "Part 1 topics", description: "Familiar topics with 3 to 5 short questions.", empty: "No Part 1 topics yet.", add: "New topic" },
  { type: "part2", title: "Part 2 cue cards", description: "A topic, 3 or 4 bullets and a line to explain.", empty: "No cue cards yet.", add: "New cue card" },
  { type: "part3", title: "Part 3 discussions", description: "4 to 6 abstract questions, optionally following a cue card.", empty: "No discussions yet.", add: "New discussion" },
];

const detail = (item: AdminIeltsItem, cards: Map<string, string>) => {
  const bits: string[] = [item.status];
  if (item.type === "part2") bits.push(`${item.cue?.bullets.length ?? 0} bullets`);
  else bits.push(`${item.questions.length} questions`);
  if (item.type === "part3" && item.cardId) bits.push(`follows ${cards.get(item.cardId) ?? "a removed card"}`);
  if (item.generated) bits.push("AI draft");
  return bits.join(" · ");
};

export default async function AdminIeltsSpeakingPage() {
  await connectDb();
  const [items, { settings }] = await Promise.all([listItemsAdmin(), getAiConfig()]);
  const cardItems = items.filter((i) => i.type === "part2");
  const cards = cardItems.map((c) => ({ id: c.id, title: c.title }));
  const cardTitles = new Map(cards.map((c) => [c.id, c.title]));
  return (
    <AdminPage title="IELTS Speaking" description="The question bank for IELTS Speaking practice and mocks. Only published items are used.">
      {SECTIONS.map((section) => (
        <AdminSection
          key={section.type}
          title={section.title}
          description={section.description}
          actions={
            <>
              {settings.active && <IeltsGenerateDraftButton type={section.type} cards={cards} />}
              <Link href={`/admin/ielts/speaking/new?type=${section.type}`} className={buttonVariants({ size: "sm" })}>
                {section.add}
              </Link>
            </>
          }
        >
          <AdminList empty={section.empty} label={section.title}>
            {items
              .filter((i) => i.type === section.type)
              .map((item) => (
                <AdminListItem key={item.id} actions={<IeltsItemStatusButton id={item.id} status={item.status} label={item.title} />}>
                  <Link href={`/admin/ielts/speaking/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{detail(item, cardTitles)}</span>
                </AdminListItem>
              ))}
          </AdminList>
        </AdminSection>
      ))}
    </AdminPage>
  );
}
