import { z } from "zod";


export const objectIdInput = z.string().regex(/^[0-9a-f]{24}$/i);
const text = (max: number) => z.string().max(max);
const count = z.number().finite().nonnegative();

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

export const framesInput = z.array(z.string().max(300 * 1024)).max(10);

export const confirmInput = z.object({ durationSec: z.number().finite(), markers: markersInput.optional() });

export function shape<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
