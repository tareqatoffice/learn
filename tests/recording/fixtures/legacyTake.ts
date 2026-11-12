import { Types } from "mongoose";

/**
 * A stored Speaking Practice take exactly as production holds it (field paths and R2 key format from
 * the schema before the recording/ extraction). Inserted with the raw driver so no schema defaults
 * or casting touch it.
 */
export const legacyUserId = new Types.ObjectId("665f1c2e9b1d8a0012a3b4c5");
export const legacyTakeId = new Types.ObjectId("665f1c2e9b1d8a0012a3b4d6");

export const legacyTake = {
  _id: legacyTakeId,
  userId: legacyUserId,
  date: "2026-06-04",
  task: "recordReview",
  lessonId: null,
  material: { title: "My hometown", prompt: "Talk about your hometown.", generated: false },
  media: {
    kind: "video",
    key: `takes/${legacyUserId}/${legacyTakeId}.webm`,
    mime: "video/webm",
    audioKey: `takes/${legacyUserId}/${legacyTakeId}.audio.webm`,
    audioMime: "audio/webm",
    durationSec: 95,
    capSec: 600,
    size: 4_200_000,
    stored: true,
  },
  transcript: "I grew up in a small town by the sea.",
  transcriptStatus: "done",
  self: { fluency: 3, confidence: 4, eyeContact: 3, gestures: 2, note: "Rushed the ending." },
  markers: [
    { atSec: 12, label: "Lost my thread" },
    { atSec: 70, label: "Good example" },
  ],
  ai: {
    speech: {
      fluency: 3,
      vocabulary: 4,
      grammar: 3,
      summary: "Clear structure, a few long pauses.",
      strengths: ["Clear opening"],
      workOn: ["Pauses before examples"],
      missedWords: [],
    },
    model: "test/model",
    at: new Date("2026-06-04T10:00:00Z"),
  },
  createdAt: new Date("2026-06-04T09:58:00Z"),
  updatedAt: new Date("2026-06-04T10:00:00Z"),
};
