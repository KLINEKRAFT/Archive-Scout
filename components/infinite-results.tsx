"use client";
import { useEffect, useRef } from "react";
export function InfiniteResults({
  enabled,
  busy,
  page,
  onNext,
}: {
  enabled: boolean;
  busy: boolean;
  page: number;
  onNext: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const requested = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || busy || !marker.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          requested.current !== page
        ) {
          requested.current = page;
          onNext();
        }
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [enabled, busy, page, onNext]);
  return (
    <div ref={marker} className="load-more" role="status" aria-live="polite">
      <span className="eyebrow">
        {busy
          ? "Finding and checking more previews…"
          : enabled
            ? "More images appear as you scroll"
            : "You’ve reached the end of the available records."}
      </span>
    </div>
  );
}
