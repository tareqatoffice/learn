import { Panel } from "@/components/Panel";

export function CoachNote({ note }: { note: string }) {
  if (!note.trim()) return null;
  return (
    <Panel title="Coach note" track="exercise">
      <p className="text-sm">{note}</p>
    </Panel>
  );
}
