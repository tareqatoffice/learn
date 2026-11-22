/**
 * Fetches the start/end photos for the exercise library from free-exercise-db
 * (Unlicense) into public/assets/exercise/<id>/0.jpg|1.jpg.
 *
 *   npm run exercise:images                    # downloads from GitHub raw
 *   npm run exercise:images -- <folder-or-url> # local checkout, or another base URL
 *
 * Only the images listed in SOURCE_IDS are fetched. The downloaded JSON is parsed as data only.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXERCISES } from "../features/exercise/library";

const DEFAULT_SOURCE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/";

/** Our exercise id -> free-exercise-db id. */
const SOURCE_IDS: Record<string, string> = {
  "push-up": "Pushups",
  "incline-push-up": "Incline_Push-Up",
  "wide-push-up": "Push-Up_Wide",
  "close-grip-push-up": "Push-Ups_-_Close_Triceps_Position",
  "feet-elevated-push-up": "Push-Ups_With_Feet_Elevated",
  "single-arm-push-up": "Single-Arm_Push-Up",
  "isometric-chest-squeeze": "Isometric_Chest_Squeezes",
  superman: "Superman",
  "bodyweight-squat": "Bodyweight_Squat",
  "glute-bridge": "Butt_Lift_Bridge",
  "single-leg-glute-bridge": "Single_Leg_Glute_Bridge",
  "walking-lunge": "Bodyweight_Walking_Lunge",
  "split-squat": "Split_Squats",
  "jump-squat": "Freehand_Jump_Squat",
  "standing-long-jump": "Standing_Long_Jump",
  "side-leg-raise": "Side_Leg_Raises",
  "rear-leg-raise": "Rear_Leg_Raises",
  "glute-kickback": "Glute_Kickback",
  plank: "Plank",
  crunch: "Crunches",
  "sit-up": "Sit-Up",
  "dead-bug": "Dead_Bug",
  "reverse-crunch": "Reverse_Crunch",
  "flutter-kicks": "Flutter_Kicks",
  "russian-twist": "Russian_Twist",
  "side-plank": "Side_Bridge",
  "bicycle-crunch": "Air_Bike",
  "heel-touch": "Alternate_Heel_Touchers",
  "oblique-crunch": "Oblique_Crunches_-_On_The_Floor",
  "scissor-kick": "Scissor_Kick",
  "jackknife-sit-up": "Jackknife_Sit-Up",
  "fast-skipping": "Fast_Skipping",
  "butt-kicks": "Double_Leg_Butt_Kick",
  carioca: "Carioca_Quick_Step",
  "mountain-climbers": "Mountain_Climbers",
  "star-jump": "Star_Jump",
  "scissor-jump": "Scissors_Jump",
  "tuck-jump": "Knee_Tuck_Jump",
  inchworm: "Inchworm",
  "spider-crawl": "Spider_Crawl",
  "childs-pose": "Childs_Pose",
  "cat-stretch": "Cat_Stretch",
  "hamstring-stretch": "Hamstring_Stretch",
  "hip-flexor-stretch": "Kneeling_Hip_Flexor",
  "calf-stretch": "Standing_Gastrocnemius_Calf_Stretch",
  "triceps-stretch": "Triceps_Stretch",
  "shoulder-stretch": "Shoulder_Stretch",
  "knee-to-chest": "Hug_Knees_To_Chest",
  "spinal-twist": "Knee_Across_The_Body",
  "neck-side-stretch": "Side_Neck_Stretch",
  "worlds-greatest-stretch": "Worlds_Greatest_Stretch",
  "arm-circles": "Arm_Circles",
};

type SourceEntry = { id: string; equipment: string | null; images: string[] };

const isUrl = (s: string) => /^https?:\/\//i.test(s);

async function readBytes(source: string, rel: string): Promise<Buffer> {
  if (!isUrl(source)) return readFileSync(path.join(source, rel));
  const base = source.endsWith("/") ? source : `${source}/`;
  const res = await fetch(new URL(rel.split("/").map(encodeURIComponent).join("/"), base));
  if (!res.ok) throw new Error(`${res.status} fetching ${rel}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const entries = JSON.parse((await readBytes(source, "dist/exercises.json")).toString("utf8")) as SourceEntry[];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const outRoot = path.join(process.cwd(), "public", "assets", "exercise");
  const perFocus: Record<string, number> = {};
  let written = 0;

  for (const ex of EXERCISES) {
    if (!ex.frames) continue;
    const srcId = SOURCE_IDS[ex.id];
    const entry = srcId ? byId.get(srcId) : undefined;
    if (!entry) throw new Error(`No source entry for ${ex.id} (${srcId ?? "unmapped"})`);
    if (entry.equipment && entry.equipment !== "body only") throw new Error(`${ex.id} needs equipment: ${entry.equipment}`);
    if (entry.images.length < 2) throw new Error(`${ex.id} has fewer than two images`);
    mkdirSync(path.join(outRoot, ex.id), { recursive: true });
    for (const frame of [0, 1] as const) {
      writeFileSync(path.join(outRoot, ex.id, `${frame}.jpg`), await readBytes(source, `exercises/${entry.images[frame]}`));
      written++;
    }
    for (const f of ex.focus) perFocus[f] = (perFocus[f] ?? 0) + 1;
  }

  const missing = EXERCISES.filter((e) => !e.frames).length;
  console.log(`Wrote ${written} images. Exercises without photos (placeholder): ${missing}.`);
  for (const [f, n] of Object.entries(perFocus).sort()) console.log(`  ${f}: ${n}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
