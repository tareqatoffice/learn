import { notFound } from "next/navigation";
import { getItemAdmin, ITEM_TYPES, listItemsAdmin, type ItemType } from "@/admin/ielts";
import { AdminCard, AdminPage } from "@/components/admin/layout";
import { IeltsSpeakingItemForm } from "@/components/admin/IeltsSpeakingItemForm";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";

const TITLES: Record<ItemType, string> = { part1: "New Part 1 topic", part2: "New cue card", part3: "New Part 3 discussion" };

export async function generateMetadata({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const item = itemId === "new" ? null : await getItemAdmin(itemId);
  return buildMetadata({
    title: `${item?.title ?? "New item"} · IELTS Speaking · Admin`,
    description: "Edit an IELTS Speaking item.",
    path: `/admin/ielts/speaking/${itemId}`,
  });
}

/** `/admin/ielts/speaking/new?type=part1|part2|part3` creates an item; any other segment is an item id. */
export default async function AdminIeltsSpeakingItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { itemId } = await params;
  await connectDb();
  const isNew = itemId === "new";
  const item = isNew ? undefined : await getItemAdmin(itemId);
  if (!isNew && !item) notFound();
  const requested = (await searchParams).type;
  const type = item?.type ?? ITEM_TYPES.find((t) => t === requested);
  if (!type) notFound();
  const cards = type === "part3" ? (await listItemsAdmin("part2")).map((c) => ({ id: c.id, title: c.title })) : [];
  return (
    <AdminPage title={item?.title ?? TITLES[type]} back={{ href: "/admin/ielts/speaking", label: "IELTS Speaking" }} width="narrow">
      <AdminCard>
        <IeltsSpeakingItemForm key={item?.id ?? type} type={type} item={item ?? undefined} cards={cards} />
      </AdminCard>
    </AdminPage>
  );
}
