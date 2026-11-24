"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { exerciseImage, type Exercise } from "../catalog";

const SWAP_MS = 800;

const reducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export function ExerciseFrames({ exercise, size }: { exercise: Exercise; size: "sm" | "lg" }) {
  return <Frames key={exercise.id} exercise={exercise} size={size} />;
}

function Frames({ exercise, size }: { exercise: Exercise; size: "sm" | "lg" }) {
  const [frame, setFrame] = useState<0 | 1>(0);

  useEffect(() => {
    if (exercise.photos.length < 2 || reducedMotion()) return;
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), SWAP_MS);
    return () => clearInterval(id);
  }, [exercise]);

  return (
    <div
      className={cn(
        "relative mx-auto aspect-3/2 w-full overflow-hidden rounded-xl bg-muted",
        size === "lg" ? "max-w-xl" : "max-w-xs",
      )}
    >
      <Image
        src={exerciseImage(exercise, frame)}
        alt={exercise.photos.length ? exercise.name : `${exercise.name} (no photo yet)`}
        fill
        sizes={size === "lg" ? "(max-width: 576px) 100vw, 576px" : "320px"}
        className="object-cover"
        draggable={false}
      />
    </div>
  );
}
