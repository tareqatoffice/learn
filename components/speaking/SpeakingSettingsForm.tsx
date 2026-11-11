"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileAction, setBodyConsentAction } from "@/app/(app)/speaking/actions";
import { firstError } from "@/admin/result";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import type { EffectiveSettings } from "@/speaking/settings";
import { TASKS, TASK_LABEL, type TaskKey } from "@/speaking/tasks";

const fieldClass =
  "w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive";

/** Per-task targets, on/off and video default; and withdrawing body-language consent. */
export function SpeakingSettingsForm({ settings }: { settings: EffectiveSettings }) {
  const router = useRouter();
  const [targets, setTargets] = useState<Record<TaskKey, string>>(
    Object.fromEntries(TASKS.map((t) => [t, String(settings.targets[t])])) as Record<TaskKey, string>,
  );
  const [enabled, setEnabled] = useState(settings.enabled);
  const [video, setVideo] = useState(settings.video);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [consent, setConsent] = useState(settings.bodyConsent);
  const [consentMessage, setConsentMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    const parsed: Partial<Record<TaskKey, number>> = {};
    for (const t of TASKS) {
      const n = Number(targets[t]);
      if (!Number.isInteger(n) || n < 1 || n > 120) local[t] = `${TASK_LABEL[t]} target must be a whole number of minutes from 1 to 120.`;
      else parsed[t] = n;
    }
    setErrors(local);
    setMessage(null);
    if (Object.keys(local).length) return;
    if (!TASKS.some((t) => enabled[t])) {
      setMessage({ tone: "error", text: "Keep at least one task on." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveProfileAction({ targets: parsed, enabled, video });
        if (!res.ok) {
          setErrors(res.errors);
          setMessage({ tone: "error", text: firstError(res.errors) ?? "Couldn't save. Try again." });
          return;
        }
        setMessage({ tone: "ok", text: "Settings saved." });
        router.refresh();
      } catch {
        setMessage({ tone: "error", text: "Couldn't save. Try again." });
      }
    });
  }

  function withdraw() {
    setConsentMessage(null);
    startTransition(async () => {
      try {
        const res = await setBodyConsentAction(false);
        if (!res.ok) return setConsentMessage({ tone: "error", text: "Couldn't save. Try again." });
        setConsent(false);
        setConsentMessage({ tone: "ok", text: "Withdrawn. Body-language feedback will ask again before sending images." });
      } catch {
        setConsentMessage({ tone: "error", text: "Couldn't save. Try again." });
      }
    });
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Daily tasks</h2>
        <ul className="grid gap-4">
          {TASKS.map((t) => (
            <li key={t} className="grid gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">{TASK_LABEL[t]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled[t]}
                    onChange={(e) => setEnabled((x) => ({ ...x, [t]: e.target.checked }))}
                    className="size-4"
                  />
                  On
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  Target
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={120}
                    step={1}
                    value={targets[t]}
                    aria-invalid={Boolean(errors[t])}
                    aria-describedby={errors[t] ? `target-${t}-error` : undefined}
                    onChange={(e) => setTargets((x) => ({ ...x, [t]: e.target.value }))}
                    className={fieldClass}
                  />
                  min a day
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={video[t]}
                    onChange={(e) => setVideo((x) => ({ ...x, [t]: e.target.checked }))}
                    className="size-4"
                  />
                  Record video by default
                </label>
              </div>
              {errors[t] && <Notice id={`target-${t}-error`}>{errors[t]}</Notice>}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </div>
      </form>

      <section aria-labelledby="body-consent" className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="body-consent" className="font-semibold">
          Body language feedback
        </h2>
        {consent ? (
          <>
            <p className="text-sm text-muted-foreground">
              You agreed that a few still images of your face, and your transcript, may be sent to an outside AI
              provider through OpenRouter when you ask for body-language feedback.
            </p>
            <Button variant="outline" className="justify-self-start" onClick={withdraw} disabled={pending}>
              Withdraw consent
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not allowed. You&apos;ll be asked before any images are sent.
          </p>
        )}
        {consentMessage && <Notice tone={consentMessage.tone}>{consentMessage.text}</Notice>}
      </section>
    </div>
  );
}
