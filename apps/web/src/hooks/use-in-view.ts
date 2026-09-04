"use client";

import { useEffect, useRef, useState } from "react";

/** Viewport gate for lazy widgets — fires once, then disconnects. */
export function useInView<T extends Element = HTMLDivElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "96px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return { ref, inView };
}
