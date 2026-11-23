import seed from "@/scripts/data/exercises.json";
import { type Exercise, toMap } from "@/features/exercise/catalog";

/** The starter library (scripts/data/exercises.json) as the app sees it, for pure tests. */
export const EXERCISES: Exercise[] = seed.map((e) => ({
  id: e.id,
  name: e.name,
  focus: e.focus as Exercise["focus"],
  type: e.type as Exercise["type"],
  difficulty: e.difficulty as Exercise["difficulty"],
  mode: e.mode as Exercise["mode"],
  equipment: e.equipment,
  cues: e.cues,
  photos: [],
  archived: false,
}));

export const EXERCISE_MAP = toMap(EXERCISES);

/** Inserts the starter library into the test database. */
export async function seedExercises(): Promise<void> {
  const { Exercise } = await import("@/models");
  await Exercise.insertMany(seed.map(({ id, ...rest }) => ({ slug: id, ...rest })));
}
