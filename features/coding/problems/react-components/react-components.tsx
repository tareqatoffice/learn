/* eslint-disable @typescript-eslint/no-unused-vars -- starter stubs leave parameters unused until solved */
/**
 * Group: React Components
 *
 * Components with real props, events, portals and error boundaries. No `any`.
 */
import { Component } from "react";
import type { ReactNode } from "react";

export interface VirtualListProps<T> {
  items: readonly T[];
  rowHeight: number;
  height: number;
  renderRow: (item: T, index: number) => ReactNode;
  overscan?: number;
}

/**
 * Render a very long list while keeping only a small window of rows in the DOM.
 *
 * - The list is a scrollable box of fixed `height` px with `data-testid="viewport"`.
 *   Every row is exactly `rowHeight` px tall
 * - The scrollbar reflects the full list height: `items.length * rowHeight`
 * - Only the rows in view plus `overscan` extra rows above and below are in
 *   the DOM. `overscan` defaults to 3
 * - Each row is rendered with `renderRow(item, index)` and sits at the right
 *   offset, so scrolling shows the correct rows
 * - Changes to `height` and to the number of `items` are handled (for
 *   example, the list shrinks while scrolled near the end)
 *
 * Example
 *   <VirtualList items={products} rowHeight={32} height={400} renderRow={(p) => <span>{p.title}</span>} />
 */
export function VirtualList<T>(_props: VirtualListProps<T>): ReactNode {
  throw new Error("Not implemented");
}

export interface TabsProps {
  tabs: readonly { id: string; label: string; content: ReactNode }[];
  /** Pass `value` to control the component. Without it, it keeps its own state. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}

/**
 * Tabs that work controlled and uncontrolled.
 *
 * - Buttons have role="tab" and aria-selected; the panel has role="tabpanel"
 * - Only the active tab's content is rendered. The first tab is the default
 * - A click calls `onChange`. When controlled, only the `value` prop changes the tab
 */
export function Tabs(_props: TabsProps): ReactNode {
  throw new Error("Not implemented");
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A dialog rendered through a portal into document.body.
 *
 * - Render nothing when closed. Open, render an element with role="dialog"
 * - Escape calls `onClose`, and only while open. Remove the listener when closed
 * - A click on the backdrop (`data-testid="backdrop"`) calls `onClose`; a click inside the dialog does not
 */
export function Modal(_props: ModalProps): ReactNode {
  throw new Error("Not implemented");
}

export interface ErrorBoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

/** Catch render errors from `children` and show `fallback`. `reset` tries `children` again. */
export class ErrorBoundary extends Component<ErrorBoundaryProps> {
  render(): ReactNode {
    return null;
  }
}

export interface TagInputProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

/**
 * A controlled tag editor around one text input.
 *
 * - Enter adds the trimmed text and clears the input. Skip empty text and duplicates
 * - Backspace in an empty input removes the last tag
 * - Each tag renders in an `li`
 */
export function TagInput(_props: TagInputProps): ReactNode {
  throw new Error("Not implemented");
}
