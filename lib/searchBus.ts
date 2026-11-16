
export const SEARCH_EVENT = "learn-search-open";

export function openSearch(): void {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}
