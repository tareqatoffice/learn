"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { exerciseImage, type Exercise } from "../library";

const SWAP_MS = 800;

const reducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** The exercise's start and end photos, swapped every 800 ms; one still frame under reduced motion. */
export function ExerciseFrames({ exercise, size }: { exercise: Exercise; size: "sm" | "lg" }) {
  return <Frames key={exercise.id} exercise={exercise} size={size} />;
}

function Frames({ exercise, size }: { exercise: Exercise; size: "sm" | "lg" }) {
  const [frame, setFrame] = useState<0 | 1>(0);

  useEffect(() => {
    if (!exercise.frames || reducedMotion()) return;
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), SWAP_MS);
    return () => clearInterval(id);
  }, [exercise]);

  return (
    <div
      className={cn(
        "mx-auto aspect-square w-full overflow-hidden rounded-xl bg-muted",
        size === "lg" ? "max-w-72" : "max-w-24",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- two static public photos swapped on a timer */}
      <img
        src={exerciseImage(exercise, frame)}
        alt={exercise.frames ? exercise.name : `${exercise.name} (no photo yet)`}
        className="size-full object-cover"
        draggable={false}
      />
    </div>
  );
}
