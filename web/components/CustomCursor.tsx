"use client";

import { useEffect, useRef } from "react";

/**
 * Figma-style custom cursor (arrow + name tag).
 *
 * Bug-avoidance:
 *  - The native cursor is hidden on EVERY element (`html.cursor-on *`), so you
 *    never get two pointers (the usual cause is per-element `cursor: pointer`).
 *  - The cursor div is updated by writing `transform` directly on a ref in the
 *    mousemove handler — no React state, so there is no render lag.
 *  - `pointer-events: none` means clicks, drags, and text selection pass
 *    straight through to the real (hidden) pointer underneath.
 *  - It hides when the pointer leaves the window or the tab loses focus, so it
 *    never gets stuck at the edge.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on touch / coarse-pointer devices (no real cursor there).
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const root = document.documentElement;
    root.classList.add("cursor-on");

    let shown = false;
    const show = () => {
      if (!shown) {
        shown = true;
        el.style.opacity = "1";
      }
    };
    const hide = () => {
      if (shown) {
        shown = false;
        el.style.opacity = "0";
      }
    };

    const onMove = (e: MouseEvent) => {
      // SVG tip sits ~1px right / ~2px down from the box origin — offset so the
      // visible tip lines up with the actual pointer position.
      el.style.transform = `translate(${e.clientX - 1}px, ${e.clientY - 2}px)`;
      show();
    };

    const onWindowLeave = (e: MouseEvent) => {
      // relatedTarget is null when the pointer actually leaves the window.
      if (!e.relatedTarget) hide();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onWindowLeave);
    window.addEventListener("blur", hide);
    document.addEventListener("mouseenter", show);

    return () => {
      root.classList.remove("cursor-on");
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onWindowLeave);
      window.removeEventListener("blur", hide);
      document.removeEventListener("mouseenter", show);
    };
  }, []);

  return (
    <div ref={ref} className="custom-cursor" aria-hidden="true">
      <svg width="23" height="32" viewBox="0 0 12.5 17.5" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill="white"
          stroke="#1a1a1a"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className="custom-cursor-label">You</span>
    </div>
  );
}
