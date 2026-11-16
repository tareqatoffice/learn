"use client";

import { useEffect } from "react";

/**
 * While `active`, asks before in-app navigation leaves the page: same-origin link clicks and Back
 * (beforeunload covers reloads and closing the tab, but never fires for client-side navigation).
 * `key` names the history entry pushed on top of the page, so Back lands on it first and can be
 * undone when the learner stays.
 */
export function useLeaveGuard(active: boolean, prompt: string, key: string): void {
  useEffect(() => {
    if (!active) return;
    // Native confirm: must stay synchronous for click/popstate gates (AlertDialog cannot block these).
    const leave = () => window.confirm(prompt);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      if (new URL(a.href, window.location.href).origin !== window.location.origin) return;
      if (!leave()) e.preventDefault();
    };
    if (!window.history.state?.[key]) window.history.pushState({ [key]: true }, "");
    const onPopState = () => {
      if (leave()) {
        window.removeEventListener("popstate", onPopState);
        window.history.back();
      } else {
        window.history.pushState({ [key]: true }, "");
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [active, prompt, key]);
}
