import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * One gentle on-scroll reveal for the marketing site (opacity + 8px rise, once).
 * Renders content fully visible when IntersectionObserver is missing or the user
 * prefers reduced motion. Never leaves content stuck invisible.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      // Fire while the block is still ~15% of a screen below the fold, so the
      // fade finishes before it is actually in view.
      { rootMargin: "0px 0px 15% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-300 ease-out motion-reduce:!translate-y-0 motion-reduce:!opacity-100 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
