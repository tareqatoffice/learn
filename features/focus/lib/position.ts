"use client";

import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** Where the floating button sits: distance from the nearer side edge, and from the bottom. */
export type FloatPos = { side: "left" | "right"; x: number; bottom: number };

export const FOCUS_POS_KEY = "learn:focus:pos:v1";
const EDGE = 8;
const DRAG_THRESHOLD = 6;

type Box = { width: number; height: number };
type Viewport = { width: number; height: number; minBottom: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Turn a button's top-left corner into a position anchored to the nearer side, kept on screen. */
export function placeAt(left: number, top: number, box: Box, vp: Viewport): FloatPos {
  const l = clamp(left, EDGE, vp.width - box.width - EDGE);
  const bottom = clamp(vp.height - top - box.height, vp.minBottom, vp.height - box.height - EDGE);
  const right = vp.width - l - box.width;
  return l + box.width / 2 < vp.width / 2 ? { side: "left", x: l, bottom } : { side: "right", x: right, bottom };
}

export function clampPos(pos: FloatPos, box: Box, vp: Viewport): FloatPos {
  return {
    side: pos.side,
    x: clamp(pos.x, EDGE, vp.width - box.width - EDGE),
    bottom: clamp(pos.bottom, vp.minBottom, vp.height - box.height - EDGE),
  };
}

export function parsePos(raw: string | null): FloatPos | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FloatPos>;
    if ((v.side !== "left" && v.side !== "right") || !Number.isFinite(v.x) || !Number.isFinite(v.bottom)) return null;
    return { side: v.side, x: v.x as number, bottom: v.bottom as number };
  } catch {
    return null;
  }
}

const DEFAULT_BOX: Box = { width: 48, height: 48 };

/** Space the fixed bars take: the bottom nav (mobile) and the sticky header. */
export function screenInsets(): { top: number; bottom: number } {
  const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
  const header = document.querySelector<HTMLElement>("[data-app-header]");
  return {
    bottom: nav ? nav.getBoundingClientRect().height : 0,
    top: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0,
  };
}

function viewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight, minBottom: screenInsets().bottom + EDGE };
}

const boxOf = (el: HTMLElement): Box => ({ width: el.offsetWidth, height: el.offsetHeight });

/**
 * Lets a fixed element be dragged anywhere on screen; the spot is remembered per browser.
 * `wasDragged()` is true once right after a drag, so the click that ends it can be ignored.
 */
export function useDragPosition(ref: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<FloatPos | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    let saved: FloatPos | null = null;
    try {
      saved = parsePos(window.localStorage.getItem(FOCUS_POS_KEY));
    } catch {
    }
    const el = ref.current;
    if (saved) setPos(clampPos(saved, el ? boxOf(el) : DEFAULT_BOX, viewport()));
    const onResize = () => {
      const node = ref.current;
      if (node) setPos((p) => p && clampPos(p, boxOf(node), viewport()));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ref]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      dragged.current = false;
      if (e.button !== 0 || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
    },
    [ref],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      const el = ref.current;
      if (!d || !el || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        el.setPointerCapture?.(e.pointerId);
      }
      setPos(placeAt(d.left + dx, d.top + dy, boxOf(el), viewport()));
    },
    [ref],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      const el = ref.current;
      drag.current = null;
      if (!d || !d.moved || !el) return;
      dragged.current = true;
      const next = placeAt(d.left + e.clientX - d.x, d.top + e.clientY - d.y, boxOf(el), viewport());
      setPos(next);
      try {
        window.localStorage.setItem(FOCUS_POS_KEY, JSON.stringify(next));
      } catch {
      }
    },
    [ref],
  );

  const onPointerCancel = useCallback(() => {
    drag.current = null;
  }, []);

  const wasDragged = useCallback(() => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }, []);

  return { pos, wasDragged, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
