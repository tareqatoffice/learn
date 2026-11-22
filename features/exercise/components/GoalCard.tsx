import { Panel } from "@/components/Panel";
import { type PaceStatus, paceLabel } from "@/features/exercise/goal";
import type { ProfileView } from "@/features/exercise/profile";

export type GoalStatus = PaceStatus;

export function GoalCard({ profile, status, kcal, streak }: { profile: ProfileView; status: GoalStatus; kcal: number; streak: number }) {
  return (
    <Panel title="Your goal" track="exercise">
      <p className="text-2xl font-semibold tracking-tight">
        {profile.startWeightKg} kg to {profile.goalWeightKg} kg
      </p>
      <p className="text-sm text-muted-foreground">
        By {profile.targetDate}. Now about {Math.round(status.currentKg * 10) / 10} kg.
      </p>
      <p className="text-sm font-medium">{paceLabel(status)}</p>
      <p className="text-sm text-muted-foreground">≈ {kcal.toLocaleString("en-US")} kcal/day (advice)</p>
      <p className="text-sm">
        {streak > 0 ? `${streak} workout${streak === 1 ? "" : "s"} in a row` : "No streak yet. Your next workout starts one."}
      </p>
    </Panel>
  );
}
