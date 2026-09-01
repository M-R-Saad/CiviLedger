/** Shape-matched loading placeholder. Replaces the literal "Loading..." text. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`motion-safe:animate-pulse rounded-control bg-surface-sunken ${className}`}
      aria-hidden="true"
    />
  );
}
