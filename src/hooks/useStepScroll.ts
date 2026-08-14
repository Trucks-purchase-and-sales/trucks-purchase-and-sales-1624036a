import { useEffect, useRef } from "react";

/**
 * Scrolls to the top of the wizard container and focuses the current step's
 * title when `step` changes. Prevents the mobile "stuck at bottom" UX.
 */
export function useStepScroll(step: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = containerRef.current;
    if (node) {
      const top = node.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Focus title
    const title = document.querySelector<HTMLElement>("[data-step-title]");
    title?.focus?.();
  }, [step]);

  return containerRef;
}
