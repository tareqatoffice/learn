/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: React Concurrent
 *
 * Suspense, transitions and the React 19 form and action hooks. No `any`.
 */
import type { ReactNode } from "react";

/** Read `promise` with `use` inside its own Suspense boundary that shows "Loading…". Render the value in a `p`. */
export function AsyncText(_props: { promise: Promise<string> }): ReactNode {
  throw new Error("Not implemented");
}

export interface LikeButtonProps {
  likes: number;
  /** Rejects when the like could not be saved. */
  onLike: () => Promise<void>;
}

/** A button showing the like count. A click shows count + 1 at once with useOptimistic, and falls back to `likes` when saving ends. */
export function LikeButton(_props: LikeButtonProps): ReactNode {
  throw new Error("Not implemented");
}

export interface SubscribeFormProps {
  /** Resolves with an error message, or null on success. */
  subscribe: (email: string) => Promise<string | null>;
}

/**
 * A form with an `email` input and a submit button, using useActionState.
 *
 * - The button is disabled while the action is pending
 * - Show the error message in an element with role="alert"
 * - On success show "Subscribed" in an element with role="status"
 */
export function SubscribeForm(_props: SubscribeFormProps): ReactNode {
  throw new Error("Not implemented");
}

/** A submit button for the surrounding form. Use useFormStatus to disable it and show "Saving…" while the form is pending, else `label`. */
export function SubmitButton(_props: { label: string }): ReactNode {
  throw new Error("Not implemented");
}

/**
 * A text input that filters `items` in a `ul` of `li`.
 *
 * - Typing updates the input at once. The list updates in a transition or with useDeferredValue
 * - While the list is behind the input, the `ul` has `aria-busy="true"`
 */
export function FilterList(_props: { items: readonly string[] }): ReactNode {
  throw new Error("Not implemented");
}
