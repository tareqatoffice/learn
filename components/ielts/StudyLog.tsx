"use client";

import { useState } from "react";
import { deleteStudyLogAction, logStudyAction } from "@/app/(app)/ielts/actions";
import { ActionStatus, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { Skill } from "@/ielts/bands";
import type { StudyLogEntry } from "@/ielts/progress";

const LOGGED: Skill[] = ["listening", "reading", "writing"];
const NAME: Record<Skill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };
const DAY = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Study done away from the app (a book, a class, a podcast), for any skill but Speaking, on today or
 * a recent day; with the latest entries so a mistake can be deleted.
 */
export function StudyLog({ today, minDate, entries }: { today: string; minDate: string; entries: StudyLogEntry[] }) {
  const [skill, setSkill] = useState<Skill>("reading");
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState(today);
  const save = useAdminAction();
  const del = useAdminAction();

  return (
    <section aria-labelledby="study-log" className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <h2 id="study-log" className="font-semibold">
        Log study
      </h2>
      <p className="text-sm text-muted-foreground">Studied away from the app? Log it so your plan counts it. Speaking minutes come from your recordings.</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() => logStudyAction(skill, Number(minutes), date));
        }}
      >
        <label className="grid gap-1 text-sm">
          Skill
          <select className={`${inputClass} w-auto`} value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
            {LOGGED.map((s) => (
              <option key={s} value={s}>
                {NAME[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Minutes
          <input type="number" inputMode="numeric" min={1} max={480} className={`${inputClass} w-24`} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Day
          <input type="date" min={minDate} max={today} className={`${inputClass} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button type="submit" variant="outline" disabled={save.pending}>
          Log
        </Button>
      </form>
      <ActionStatus saved={save.saved} errors={save.errors} savedText="Logged." />

      {entries.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
              <span>
                {NAME[e.skill]} · {e.minutes} min · <span className="text-muted-foreground">{DAY.format(new Date(`${e.date}T00:00:00Z`))}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={del.pending}
                aria-label={`Delete ${NAME[e.skill]} ${e.minutes} minutes on ${e.date}`}
                onClick={() => del.run(() => deleteStudyLogAction(e.id), { confirm: "Delete this study entry?" })}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ActionStatus saved={false} errors={del.errors} />
    </section>
  );
}
