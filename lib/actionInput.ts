import { z } from "zod";

// Shapes for Server Action arguments. Actions are public endpoints, so whatever the client sends is
// checked for type and size here; the domain functions keep the rules and the user-facing messages.

export const objectIdInput = z.string().regex(/^[0-9a-f]{24}$/i);
const text = (max: number) => z.string().max(max);
const count = z.number().finite().nonnegative();

/** A recording upload request (Speaking takes and IELTS Speaking parts). */
export const recordingInput = z.object({
  kind: z.string().max(10),
  mime: text(100),
  audioMime: text(100).optional(),
  size: count,
  audioSize: count.optional(),
});

export const takeInput = recordingInput.extend({
  task: text(30),
  date: text(10).optional(),
  lessonId: objectIdInput.nullable().optional(),
  material: z
    .object({ title: text(5000).optional(), text: text(5000).optional(), prompt: text(5000).optional(), generated: z.boolean().optional() })
    .optional(),
});

export const markersInput = z.array(z.object({ atSec: z.number().finite(), label: text(200) })).max(100);

export const selfRatingInput = z.object({
  fluency: z.number().finite(),
  confidence: z.number().finite(),
  eyeContact: z.number().finite().optional(),
  gestures: z.number().finite().optional(),
  note: text(5000).optional(),
  markers: markersInput.optional(),
});

/** Video stills for body-language feedback; the coach checks each one's format and size. */
export const framesInput = z.array(z.string().max(300 * 1024)).max(10);

export const confirmInput = z.object({ durationSec: z.number().finite(), markers: markersInput.optional() });

/** Parses `value`, or null when it doesn't have the expected shape. */
export function shape<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
