/**
 * True for the error Next uses to carry a redirect or notFound out of an action: a start button that
 * catches failures must let it through, or a successful start would show as an error.
 */
export function isNavigationError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

export const START_FAILED = "Couldn't start the quiz. Check your connection and try again.";
