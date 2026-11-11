"use client";

import { useId, useState, useTransition } from "react";
import { saveAiSettingsAction, testAiModelsAction } from "@/app/(app)/admin/ai/actions";
import { Field } from "@/components/admin/fields";
import { SaveBar, inputClass } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { MODEL_ID_MAX } from "@/lib/ai-limits";
import type { CatalogModel, ModelCheck } from "@/lib/openrouter";

export type AiSettingsDraft = { enabled: boolean; primaryModel: string; fallbackModel: string; visionModel?: string; dailyLimit: number };

const CUSTOM = "__custom__";

const optionLabel = (m: CatalogModel) =>
  `${m.name}${m.contextLength ? ` · ${Math.round(m.contextLength / 1000)}k context` : ""}${m.json === false ? " · no JSON mode" : ""}`;

/**
 * A model from OpenRouter's catalogue (free ones, plus paid ones when `showPaid`), or any model id
 * typed by hand. The current value is always listed, even when the filter would hide it.
 */
export function ModelPicker({
  label,
  value,
  onChange,
  catalog,
  showPaid,
  noneLabel,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  catalog: CatalogModel[];
  showPaid: boolean;
  /** Offers an empty choice with this label. */
  noneLabel?: string;
  error?: string;
}) {
  const id = useId();
  const known = catalog.some((m) => m.id === value);
  const [custom, setCustom] = useState(Boolean(value) && !known);
  const shown = catalog.filter((m) => m.free || showPaid || m.id === value);
  const free = shown.filter((m) => m.free);
  const paid = shown.filter((m) => !m.free);
  const current = catalog.find((m) => m.id === value);

  if (!catalog.length) {
    return (
      <Field label={label} error={error}>
        <input
          className={inputClass}
          value={value}
          maxLength={MODEL_ID_MAX}
          placeholder={noneLabel ? `Blank for ${noneLabel.toLowerCase()}` : "vendor/model:free"}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </Field>
    );
  }

  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        className={inputClass}
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          const next = e.target.value;
          setCustom(next === CUSTOM);
          if (next !== CUSTOM) onChange(next);
        }}
      >
        {noneLabel && <option value="">{noneLabel}</option>}
        {!noneLabel && !value && !custom && <option value="">Choose a model…</option>}
        {free.length > 0 && (
          <optgroup label={`Free models (${free.length})`}>
            {free.map((m) => (
              <option key={m.id} value={m.id}>
                {optionLabel(m)}
              </option>
            ))}
          </optgroup>
        )}
        {paid.length > 0 && (
          <optgroup label="Paid models">
            {paid.map((m) => (
              <option key={m.id} value={m.id}>
                {optionLabel(m)}
              </option>
            ))}
          </optgroup>
        )}
        <option value={CUSTOM}>Other model id…</option>
      </select>
      {custom ? (
        <input
          aria-label={`${label} id`}
          className={inputClass}
          value={value}
          maxLength={MODEL_ID_MAX}
          placeholder="vendor/model:free"
          onChange={(e) => onChange(e.target.value.trim())}
        />
      ) : (
        value && (
          <span className="text-xs text-muted-foreground">
            <code>{value}</code>
            {current && (current.free ? " · free" : " · paid")}
            {current?.json === false && (
              <span className="block text-destructive">
                Does not support JSON replies, so answer checks may fail. Pick a model that does, or use one as the backup only.
              </span>
            )}
          </span>
        )
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}

export function AiSettingsForm({
  initial,
  keyConfigured,
  catalog,
  catalogError,
}: {
  initial: AiSettingsDraft;
  keyConfigured: boolean;
  catalog: CatalogModel[];
  catalogError?: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [limitText, setLimitText] = useState(String(initial.dailyLimit));
  const [showPaid, setShowPaid] = useState(false);
  const { run, pending, errors, saved, touch } = useAdminAction();
  const [checks, setChecks] = useState<ModelCheck[] | null>(null);
  const [testing, startTesting] = useTransition();
  const freeCount = catalog.filter((m) => m.free).length;

  const set = <K extends keyof AiSettingsDraft>(key: K, value: AiSettingsDraft[K]) => {
    touch();
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dailyLimit = limitText.trim() === "" ? Number.NaN : Number(limitText);
    run(() => saveAiSettingsAction({ ...draft, dailyLimit }));
  };

  const models = [draft.primaryModel, draft.fallbackModel].filter(Boolean);
  const test = () =>
    startTesting(async () => {
      setChecks(null);
      try {
        setChecks(await testAiModelsAction(models));
      } catch {
        setChecks(models.map((model) => ({ model, ok: false, ms: 0, error: "Not a valid model id" })));
      }
    });

  return (
    <form onSubmit={submit} className="grid gap-5" aria-label="Models and limits">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={draft.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        <span>
          <span className="font-medium">Offer the AI coach in quizzes</span>
          <span className="block text-muted-foreground">
            {keyConfigured ? "Learners can check answers and ask follow-ups." : "Needs an OpenRouter key first (above)."}
          </span>
        </span>
      </label>

      {catalogError && (
        <p role="status" className="text-sm text-muted-foreground">
          {catalogError}
        </p>
      )}
      {catalog.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />
          Also list paid models <span className="text-muted-foreground">({freeCount} free models available)</span>
        </label>
      )}

      <ModelPicker
        label="Primary model"
        value={draft.primaryModel}
        onChange={(v) => set("primaryModel", v)}
        catalog={catalog}
        showPaid={showPaid}
        error={errors.primaryModel}
      />
      <ModelPicker
        label="Backup model"
        value={draft.fallbackModel}
        onChange={(v) => set("fallbackModel", v)}
        catalog={catalog}
        showPaid={showPaid}
        noneLabel="No backup"
        error={errors.fallbackModel}
      />

      <ModelPicker
        label="Vision model"
        value={draft.visionModel ?? ""}
        onChange={(v) => set("visionModel", v)}
        catalog={catalog.filter((m) => m.images)}
        showPaid={showPaid}
        noneLabel="Use the primary model"
        error={errors.visionModel}
      />

      <Field label="AI calls per learner per day" error={errors.dailyLimit}>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={`${inputClass} max-w-40`}
          value={limitText}
          onChange={(e) => {
            touch();
            setLimitText(e.target.value);
          }}
        />
        <span className="text-xs text-muted-foreground">Checks and follow-ups both count; 0 means no limit. Resets at midnight UTC.</span>
      </Field>

      <div className="grid gap-2">
        <div>
          <Button type="button" variant="outline" size="sm" disabled={testing || !keyConfigured || !models.length} onClick={test}>
            {testing ? "Testing…" : "Test models"}
          </Button>
        </div>
        {checks && (
          <ul aria-label="Model test results" className="grid gap-1 text-sm">
            {checks.map((c) => (
              <li key={c.model}>
                <span className={c.ok ? "text-ok" : "text-destructive"}>{c.ok ? "✓" : "✗"}</span> <code>{c.model}</code>{" "}
                <span className="text-muted-foreground">
                  {c.ok ? `answered in ${(c.ms / 1000).toFixed(1)} s` : c.error}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SaveBar label="Save settings" pending={pending} saved={saved} errors={errors} />
    </form>
  );
}
