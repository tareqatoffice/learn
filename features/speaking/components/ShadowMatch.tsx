import { useMemo } from "react";
import { Card } from "@/components/Card";
import { wordMatch } from "@/features/speaking/shadowText";

export function ShadowMatch({ reference, transcript }: { reference: string; transcript: string }) {
  const result = useMemo(() => wordMatch(reference, transcript), [reference, transcript]);
  if (!result.total) return null;

  return (
    <Card as="section" aria-labelledby="word-match" className="grid gap-2">
      <h2 id="word-match" className="font-semibold">
        Words matched
      </h2>
      <p className="text-2xl font-semibold tabular-nums">{result.score}%</p>
      <p className="text-sm text-muted-foreground">
        {result.matched} of {result.total} words from the text were heard in your take, in order. It is based on the
        automatic transcript, so a clear word can still be missed.
      </p>
      {result.missed.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Not heard: </span>
          {result.missed.join(", ")}
        </p>
      )}
    </Card>
  );
}
