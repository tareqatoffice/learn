import { cache } from "react";
import { connectDb } from "@/lib/db";
import { storageConfigured } from "@/lib/r2";
import { Exercise as ExerciseModel } from "@/models";
import type { Difficulty, ExerciseMode, ExerciseType, Focus } from "@/models/exerciseConstants";
import { type Exercise, type ExerciseMap, photoUrl, toMap } from "./catalog";

export type ExerciseRow = {
  slug: string;
  name: string;
  focus?: Focus[];
  type: ExerciseType;
  difficulty: Difficulty;
  mode: ExerciseMode;
  equipment?: string;
  cues?: string[];
  startPhoto?: string;
  endPhoto?: string;
  archived?: boolean;
  order?: number;
};

export const toExercise = (d: ExerciseRow, storage = storageConfigured()): Exercise => ({
  id: d.slug,
  name: d.name,
  focus: [...(d.focus ?? [])],
  type: d.type,
  difficulty: d.difficulty,
  mode: d.mode,
  equipment: d.equipment || "none",
  cues: [...(d.cues ?? [])],
  photos: storage ? [d.startPhoto, d.endPhoto].filter((k): k is string => Boolean(k)).map(photoUrl) : [],
  archived: Boolean(d.archived),
});

export const listExercises = cache(async (): Promise<Exercise[]> => {
  await connectDb();
  const rows = await ExerciseModel.find({}).sort({ order: 1, name: 1 }).lean<ExerciseRow[]>();
  const storage = storageConfigured();
  return rows.map((row) => toExercise(row, storage));
});

export async function activeExercises(): Promise<Exercise[]> {
  return (await listExercises()).filter((e) => !e.archived);
}

export async function exerciseMap(): Promise<ExerciseMap> {
  return toMap(await listExercises());
}
