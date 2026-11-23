import type { Focus } from "@/models/exerciseConstants";

export type Exercise = {
  id: string;
  name: string;
  focus: Focus[];
  type: "strength" | "cardio" | "hiit" | "stretch";
  difficulty: 1 | 2 | 3;
  mode: "reps" | "time";
  equipment: "none";
  cues: string[];
  /** Start and end photos under `public/`; `null` falls back to the placeholder. */
  frames: [string, string] | null;
};

const PLACEHOLDER = "/assets/exercise/placeholder.svg";

const photo = (id: string): [string, string] => [`/assets/exercise/${id}/0.jpg`, `/assets/exercise/${id}/1.jpg`];

export const EXERCISES: readonly Exercise[] = [
  // Upper body
  { id: "push-up", name: "Push-up", focus: ["upper", "full"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Hands under shoulders, body in one straight line.", "Lower your chest to just above the floor.", "Press up without sagging your hips."], frames: photo("push-up") },
  { id: "incline-push-up", name: "Incline push-up", focus: ["upper"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Hands on a sturdy bench or counter, body straight.", "Bend your elbows to bring your chest toward the edge.", "Push back up, keeping your core tight."], frames: photo("incline-push-up") },
  { id: "wide-push-up", name: "Wide push-up", focus: ["upper"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Place hands wider than your shoulders.", "Lower with elbows flaring slightly out.", "Drive the floor away to finish."], frames: photo("wide-push-up") },
  { id: "close-grip-push-up", name: "Close-grip push-up", focus: ["upper"], type: "strength", difficulty: 3, mode: "reps", equipment: "none", cues: ["Hands close together under your chest.", "Keep elbows tucked against your ribs as you lower.", "Press up fully without letting the hips drop."], frames: photo("close-grip-push-up") },
  { id: "feet-elevated-push-up", name: "Feet-elevated push-up", focus: ["upper", "core"], type: "strength", difficulty: 3, mode: "reps", equipment: "none", cues: ["Rest your feet on a step or sofa, hands on the floor.", "Keep a rigid line from head to heels.", "Lower slowly and press back up."], frames: photo("feet-elevated-push-up") },
  { id: "single-arm-push-up", name: "Single-arm push-up", focus: ["upper", "core"], type: "strength", difficulty: 3, mode: "reps", equipment: "none", cues: ["Feet wide for balance, one hand behind your back.", "Keep your hips square to the floor.", "Lower under control and press up."], frames: photo("single-arm-push-up") },
  { id: "isometric-chest-squeeze", name: "Chest squeeze", focus: ["upper"], type: "strength", difficulty: 1, mode: "time", equipment: "none", cues: ["Press your palms together in front of your chest.", "Push hard and hold the tension.", "Keep shoulders down and breathe steadily."], frames: photo("isometric-chest-squeeze") },
  { id: "superman", name: "Superman", focus: ["upper", "core"], type: "strength", difficulty: 1, mode: "time", equipment: "none", cues: ["Lie face down with arms reaching forward.", "Lift arms, chest and legs a few inches together.", "Hold, looking at the floor to keep your neck long."], frames: photo("superman") },
  // Lower body
  { id: "bodyweight-squat", name: "Bodyweight squat", focus: ["lower", "full"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Feet shoulder-width apart, chest up.", "Sit your hips back and down until thighs are near parallel.", "Drive through your heels to stand."], frames: photo("bodyweight-squat") },
  { id: "glute-bridge", name: "Glute bridge", focus: ["lower", "core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie on your back, knees bent, feet flat.", "Squeeze your glutes and lift your hips.", "Pause at the top, then lower slowly."], frames: photo("glute-bridge") },
  { id: "single-leg-glute-bridge", name: "Single-leg glute bridge", focus: ["lower"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Extend one leg straight, other foot planted.", "Lift your hips level without twisting.", "Lower with control and switch sides."], frames: photo("single-leg-glute-bridge") },
  { id: "walking-lunge", name: "Walking lunge", focus: ["lower", "full"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Take a long step forward and drop your back knee.", "Keep your front knee over your ankle.", "Push off and step through to the next lunge."], frames: photo("walking-lunge") },
  { id: "split-squat", name: "Split squat", focus: ["lower"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Stand in a long stride with feet staying planted.", "Lower straight down, torso upright.", "Press through the front heel to rise."], frames: photo("split-squat") },
  { id: "jump-squat", name: "Jump squat", focus: ["lower", "cardio"], type: "hiit", difficulty: 3, mode: "reps", equipment: "none", cues: ["Squat down, then explode upward.", "Land softly on bent knees.", "Reset your stance before the next rep."], frames: photo("jump-squat") },
  { id: "standing-long-jump", name: "Standing long jump", focus: ["lower"], type: "hiit", difficulty: 2, mode: "reps", equipment: "none", cues: ["Swing your arms back and load your hips.", "Jump forward as far as you can.", "Absorb the landing with soft knees, then reset."], frames: photo("standing-long-jump") },
  { id: "side-leg-raise", name: "Side-lying leg raise", focus: ["lower"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie on your side with hips stacked.", "Lift the top leg without rolling backward.", "Lower slowly and repeat before switching."], frames: photo("side-leg-raise") },
  { id: "rear-leg-raise", name: "Rear leg raise", focus: ["lower"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Stand tall holding a wall for balance.", "Lift one leg straight behind you.", "Squeeze your glute and lower with control."], frames: photo("rear-leg-raise") },
  { id: "glute-kickback", name: "Quadruped glute kickback", focus: ["lower"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Start on hands and knees, back flat.", "Press one foot up toward the ceiling.", "Stop before your lower back arches."], frames: photo("glute-kickback") },
  { id: "wall-sit", name: "Wall sit", focus: ["lower"], type: "strength", difficulty: 1, mode: "time", equipment: "none", cues: ["Back flat against a wall, thighs level with the floor.", "Knees stacked over ankles.", "Hold and breathe while your legs burn."], frames: null },
  { id: "calf-raise", name: "Calf raise", focus: ["lower"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Stand tall, feet hip-width apart.", "Rise onto the balls of your feet.", "Lower slowly back down."], frames: null },
  // Core
  { id: "plank", name: "Plank", focus: ["core", "upper", "full"], type: "strength", difficulty: 1, mode: "time", equipment: "none", cues: ["Forearms under shoulders, body in a straight line.", "Brace your belly and squeeze your glutes.", "Keep breathing; do not let your hips sag."], frames: photo("plank") },
  { id: "crunch", name: "Crunch", focus: ["core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie on your back with knees bent.", "Curl your shoulders off the floor using your abs.", "Lower slowly without yanking your neck."], frames: photo("crunch") },
  { id: "sit-up", name: "Sit-up", focus: ["core"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Feet flat, arms crossed or by your ears.", "Roll up to sitting in one smooth motion.", "Lower back down with control."], frames: photo("sit-up") },
  { id: "dead-bug", name: "Dead bug", focus: ["core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie on your back, arms up, knees over hips.", "Lower the opposite arm and leg toward the floor.", "Keep your lower back pressed down, then switch."], frames: photo("dead-bug") },
  { id: "reverse-crunch", name: "Reverse crunch", focus: ["core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie back with knees pulled toward your chest.", "Curl your hips off the floor toward your ribs.", "Lower slowly, no swinging."], frames: photo("reverse-crunch") },
  { id: "flutter-kicks", name: "Flutter kicks", focus: ["core"], type: "strength", difficulty: 2, mode: "time", equipment: "none", cues: ["Lie back with legs straight and hovering.", "Kick small, quick alternating beats.", "Press your lower back into the floor."], frames: photo("flutter-kicks") },
  { id: "russian-twist", name: "Russian twist", focus: ["core"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Sit leaning back with your chest tall.", "Rotate your torso from side to side.", "Lift your feet for more challenge."], frames: photo("russian-twist") },
  { id: "side-plank", name: "Side plank", focus: ["core"], type: "strength", difficulty: 2, mode: "time", equipment: "none", cues: ["Stack feet, elbow under your shoulder.", "Lift your hips so your body is one line.", "Hold, then switch sides."], frames: photo("side-plank") },
  { id: "bicycle-crunch", name: "Air bike", focus: ["core"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Hands by your ears, shoulders lifted.", "Drive one elbow toward the opposite knee.", "Pedal your legs in a steady rhythm."], frames: photo("bicycle-crunch") },
  { id: "heel-touch", name: "Alternating heel touch", focus: ["core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Lie with knees bent and shoulders slightly raised.", "Reach one hand toward the same-side heel.", "Alternate sides, keeping the motion small."], frames: photo("heel-touch") },
  { id: "oblique-crunch", name: "Oblique crunch", focus: ["core"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Lie on your back with knees bent.", "Curl your ribs toward your hip.", "Lower slowly and finish all reps per side."], frames: photo("oblique-crunch") },
  { id: "scissor-kick", name: "Scissor kick", focus: ["core"], type: "strength", difficulty: 2, mode: "time", equipment: "none", cues: ["Lie back, legs lifted a few inches.", "Cross one leg over the other in a scissor motion.", "Keep your lower back flat."], frames: photo("scissor-kick") },
  { id: "jackknife-sit-up", name: "Jackknife sit-up", focus: ["core"], type: "strength", difficulty: 3, mode: "reps", equipment: "none", cues: ["Lie flat with arms overhead and legs straight.", "Lift arms and legs to meet over your hips.", "Lower with control and repeat."], frames: photo("jackknife-sit-up") },
  { id: "bird-dog", name: "Bird dog", focus: ["core"], type: "strength", difficulty: 1, mode: "reps", equipment: "none", cues: ["Start on hands and knees, back flat.", "Reach the opposite arm and leg out long.", "Pause, then return and switch sides."], frames: null },
  // Cardio / HIIT
  { id: "jumping-jacks", name: "Jumping jacks", focus: ["cardio", "full"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Jump feet wide as your arms swing overhead.", "Jump back to standing with hands at your sides.", "Stay light on the balls of your feet."], frames: null },
  { id: "high-knees", name: "High knees", focus: ["cardio"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Run in place driving your knees to hip height.", "Pump your arms in rhythm.", "Stay tall and land softly."], frames: null },
  { id: "fast-skipping", name: "Fast skipping", focus: ["cardio"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Skip in place with quick, bouncy steps.", "Swing opposite arm and knee together.", "Keep it light and rhythmic."], frames: photo("fast-skipping") },
  { id: "butt-kicks", name: "Butt kicks", focus: ["cardio", "lower"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Jog in place flicking heels toward your glutes.", "Keep your thighs mostly vertical.", "Stay upright and breathe evenly."], frames: photo("butt-kicks") },
  { id: "carioca", name: "Carioca step", focus: ["cardio", "lower"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Move sideways crossing one foot in front, then behind.", "Rotate your hips as you travel.", "Keep quick, light steps."], frames: photo("carioca") },
  { id: "march-in-place", name: "March in place", focus: ["cardio"], type: "cardio", difficulty: 1, mode: "time", equipment: "none", cues: ["Lift your knees at a steady pace.", "Swing your arms naturally.", "Raise the pace as you warm up."], frames: null },
  { id: "mountain-climbers", name: "Mountain climbers", focus: ["cardio", "core", "full"], type: "hiit", difficulty: 2, mode: "time", equipment: "none", cues: ["Start in a high plank, hands under shoulders.", "Drive your knees toward your chest in turn.", "Keep your hips low and level."], frames: photo("mountain-climbers") },
  { id: "star-jump", name: "Star jump", focus: ["cardio", "full"], type: "hiit", difficulty: 2, mode: "time", equipment: "none", cues: ["Crouch, then burst up with arms and legs wide.", "Land softly and go straight into the next one.", "Reach long at the top."], frames: photo("star-jump") },
  { id: "scissor-jump", name: "Scissor jump", focus: ["cardio", "lower"], type: "hiit", difficulty: 2, mode: "time", equipment: "none", cues: ["Jump and switch your legs front to back.", "Land softly on both feet.", "Keep your chest up."], frames: photo("scissor-jump") },
  { id: "tuck-jump", name: "Knee tuck jump", focus: ["cardio", "lower"], type: "hiit", difficulty: 3, mode: "reps", equipment: "none", cues: ["Jump straight up and pull both knees in.", "Land softly with bent knees.", "Reset your balance before the next one."], frames: photo("tuck-jump") },
  { id: "burpee", name: "Burpee", focus: ["full", "cardio"], type: "hiit", difficulty: 3, mode: "reps", equipment: "none", cues: ["Squat and place your hands on the floor.", "Jump your feet back, then in again.", "Stand and jump with hands overhead."], frames: null },
  { id: "inchworm", name: "Inchworm", focus: ["full", "stretch"], type: "strength", difficulty: 2, mode: "reps", equipment: "none", cues: ["Fold forward and walk your hands out to a plank.", "Pause with a flat back.", "Walk your hands back to your feet and stand."], frames: photo("inchworm") },
  { id: "spider-crawl", name: "Spider crawl", focus: ["full", "core"], type: "strength", difficulty: 2, mode: "time", equipment: "none", cues: ["Crawl forward in a low plank position.", "Bring each knee toward the same-side elbow.", "Keep your hips low."], frames: photo("spider-crawl") },
  // Stretching
  { id: "childs-pose", name: "Child's pose", focus: ["stretch"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Kneel and sit your hips back toward your heels.", "Reach your arms long in front of you.", "Breathe slowly into your back."], frames: photo("childs-pose") },
  { id: "cat-stretch", name: "Cat stretch", focus: ["stretch", "core"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["On hands and knees, round your spine up.", "Tuck your chin and pelvis.", "Move slowly with your breathing."], frames: photo("cat-stretch") },
  { id: "hamstring-stretch", name: "Hamstring stretch", focus: ["stretch", "lower"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Sit with one leg straight, the other bent.", "Hinge forward from your hips.", "Hold at a gentle pull, then switch."], frames: photo("hamstring-stretch") },
  { id: "hip-flexor-stretch", name: "Kneeling hip flexor stretch", focus: ["stretch", "lower"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Kneel in a lunge, back knee down.", "Tuck your pelvis and shift forward gently.", "Feel the stretch at the front of your back hip."], frames: photo("hip-flexor-stretch") },
  { id: "calf-stretch", name: "Standing calf stretch", focus: ["stretch", "lower"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Hands on a wall, one leg stepped back.", "Press the back heel into the floor.", "Lean in until you feel your calf stretch."], frames: photo("calf-stretch") },
  { id: "triceps-stretch", name: "Triceps stretch", focus: ["stretch", "upper"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Raise one arm and bend the elbow behind your head.", "Use the other hand to ease the elbow back.", "Keep your ribs down; switch sides."], frames: photo("triceps-stretch") },
  { id: "shoulder-stretch", name: "Cross-body shoulder stretch", focus: ["stretch", "upper"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Bring one arm across your chest.", "Hug it close with your other hand.", "Keep your shoulder relaxed; switch sides."], frames: photo("shoulder-stretch") },
  { id: "knee-to-chest", name: "Knees to chest", focus: ["stretch", "lower"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Lie on your back and hug your knees in.", "Let your lower back relax into the floor.", "Breathe slowly and hold."], frames: photo("knee-to-chest") },
  { id: "spinal-twist", name: "Lying spinal twist", focus: ["stretch", "core"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Lie back and drop one bent knee across your body.", "Keep both shoulders on the floor.", "Hold, then switch sides."], frames: photo("spinal-twist") },
  { id: "neck-side-stretch", name: "Side neck stretch", focus: ["stretch", "upper"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Sit or stand tall, ear toward your shoulder.", "Keep the opposite shoulder pressed down.", "Hold gently, never forcing it; switch sides."], frames: photo("neck-side-stretch") },
  { id: "worlds-greatest-stretch", name: "World's greatest stretch", focus: ["stretch", "full"], type: "stretch", difficulty: 2, mode: "time", equipment: "none", cues: ["Step into a deep lunge with both hands inside the front foot.", "Rotate your chest and reach one arm to the sky.", "Return and switch sides."], frames: photo("worlds-greatest-stretch") },
  { id: "arm-circles", name: "Arm circles", focus: ["stretch", "upper"], type: "stretch", difficulty: 1, mode: "time", equipment: "none", cues: ["Arms out to the sides at shoulder height.", "Draw big smooth circles, then reverse.", "Keep your neck relaxed."], frames: photo("arm-circles") },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function exerciseById(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function allowedFor(focus: Focus, maxDifficulty: 1 | 2 | 3): Exercise[] {
  return EXERCISES.filter((e) => e.focus.includes(focus) && e.difficulty <= maxDifficulty);
}

export function exerciseImage(e: Exercise, frame: 0 | 1): string {
  return e.frames ? e.frames[frame] : PLACEHOLDER;
}
