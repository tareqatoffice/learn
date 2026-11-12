"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createItemAction, deleteItemAction, updateItemAction } from "@/app/(app)/admin/ielts/speaking/actions";
import type { AdminIeltsItem, ItemStatus, ItemType } from "@/admin/ielts";
import { Field, TextField } from "@/components/admin/fields";
import { ActionStatus, SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";

const join = (items: string[]) => items.join("\n");
const split = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** The line-per-entry text areas hold their text as typed; they are split into lists on save. */
type Draft = {
  id: string;
  title: string;
  status: ItemStatus;
  aboutYou: boolean;
  tags: string;
  questions: string;
  topic: string;
  bullets: string;
  explain: string;
  roundOff: string;
  cardId: string;
};

const toDraft = (item?: AdminIeltsItem): Draft => ({
  id: item?.id ?? "",
  title: item?.title ?? "",
  status: item?.status ?? "draft",
  aboutYou: item?.aboutYou ?? false,
  tags: (item?.tags ?? []).join(", "),
  questions: join(item?.questions ?? []),
  topic: item?.cue?.topic ?? "",
  bullets: join(item?.cue?.bullets ?? []),
  explain: item?.cue?.explain ?? "",
  roundOff: join(item?.cue?.roundOff ?? []),
  cardId: item?.cardId ?? "",
});

const PART_NAME: Record<ItemType, string> = { part1: "Part 1 topic", part2: "Part 2 cue card", part3: "Part 3 discussion" };
const BACK = { href: "/admin/ielts/speaking", label: "IELTS Speaking" };

/** Create or edit one Part 1 frame, Part 2 cue card or Part 3 question set. */
export function IeltsSpeakingItemForm({ type, item, cards }: { type: ItemType; item?: AdminIeltsItem; cards: { id: string; title: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(item));
  const { run, pending, errors, saved, touch } = useAdminAction();
  const del = useAdminAction();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    touch();
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = { title: draft.title, status: draft.status, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    const input =
      type === "part1"
        ? { ...base, type, aboutYou: draft.aboutYou, questions: split(draft.questions) }
        : type === "part2"
          ? { ...base, type, topic: draft.topic, bullets: split(draft.bullets), explain: draft.explain, roundOff: split(draft.roundOff) }
          : { ...base, type, questions: split(draft.questions), cardId: draft.cardId };
    if (draft.id) run(() => updateItemAction(draft.id, input));
    else run(() => createItemAction(input), { refresh: false, onSuccess: (r) => router.push(`/admin/ielts/speaking/${r.id}`) });
  };

  return (
    <form className="grid gap-5" onSubmit={submit} aria-label={PART_NAME[type]}>
      <TextField label="Title" value={draft.title} error={errors.title} onChange={(v) => set("title", v)} />

      <Field label="Status" group error={errors.status}>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          <Chip on={draft.status === "draft"} onClick={() => set("status", "draft")}>
            Draft
          </Chip>
          <Chip on={draft.status === "published"} onClick={() => set("status", "published")}>
            Published
          </Chip>
        </div>
      </Field>

      {type === "part1" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.aboutYou} onChange={(e) => set("aboutYou", e.target.checked)} />
          <span>About you (work, study or home)</span>
        </label>
      )}

      {type === "part2" ? (
        <>
          <TextField label="Topic (the Describe line)" value={draft.topic} error={errors.topic} onChange={(v) => set("topic", v)} />
          <Field label="Bullets (3 or 4, one per line)" error={errors.bullets}>
            <textarea className={inputClass} rows={4} value={draft.bullets} onChange={(e) => set("bullets", e.target.value)} />
          </Field>
          <TextField label="Explain line (and explain ...)" value={draft.explain} error={errors.explain} onChange={(v) => set("explain", v)} />
          <Field label="Round-off lines (0 to 2, one per line)" error={errors.roundOff}>
            <textarea className={inputClass} rows={2} value={draft.roundOff} onChange={(e) => set("roundOff", e.target.value)} />
          </Field>
        </>
      ) : (
        <Field label={type === "part1" ? "Questions (3 to 5, one per line)" : "Questions (4 to 6, one per line)"} error={errors.questions}>
          <textarea className={inputClass} rows={6} value={draft.questions} onChange={(e) => set("questions", e.target.value)} />
        </Field>
      )}

      {type === "part3" && (
        <Field label="Follows cue card" error={errors.cardId}>
          <select className={inputClass} value={draft.cardId} onChange={(e) => set("cardId", e.target.value)}>
            <option value="">None</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <TextField label="Tags (comma separated)" value={draft.tags} error={errors.tags} onChange={(v) => set("tags", v)} />

      <SaveBar label={draft.id ? "Save item" : "Create item"} pending={pending} saved={saved} errors={errors}>
        {draft.id && (
          <Button
            type="button"
            variant="outline"
            disabled={del.pending}
            onClick={() =>
              del.run(() => deleteItemAction(draft.id), {
                confirm: type === "part2" ? "Delete this cue card? Part 3 sets that follow it stay, unlinked." : "Delete this item?",
                refresh: false,
                onSuccess: () => router.push(BACK.href),
              })
            }
          >
            Delete item
          </Button>
        )}
      </SaveBar>
      <ActionStatus saved={false} errors={del.errors} />
    </form>
  );
}
