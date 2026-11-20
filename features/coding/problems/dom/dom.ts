/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: DOM
 *
 * Use browser APIs. These run in the page, so the checks use detached elements. No `any`.
 */

/** Escape & < > " and ' for safe use in HTML. */
export function escapeHtml(_input: string): string {
  throw new Error("Not implemented");
}

/** Create an element. Attributes use setAttribute; string children become text nodes, never parsed as HTML. */
export function h(_tag: string, _attributes: Record<string, string>, ..._children: readonly (string | Node)[]): HTMLElement {
  throw new Error("Not implemented");
}

/** Listen on `root`, calling `handler` with the closest match to `selector` inside root. Return a remove function. */
export function delegate(
  _root: HTMLElement,
  _event: string,
  _selector: string,
  _handler: (match: Element, event: Event) => void,
): () => void {
  throw new Error("Not implemented");
}

/** Read a form into an object. Skip unchecked checkboxes and radios and disabled fields. Repeated names become arrays. */
export function serializeForm(_form: HTMLFormElement): Record<string, string | string[]> {
  throw new Error("Not implemented");
}
