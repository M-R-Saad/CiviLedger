import type { SVGProps } from "react";

// Minimal inline icon set. Phase 3 swaps this for `lucide-react` (same visual weight).
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconDash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconExternal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function Spinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M19 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconFilePlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M12 12v6M9 15h6" />
    </svg>
  );
}

export function IconList(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M4 21h18M8 7h.01M8 11h.01M8 15h.01M12 7h.01M12 11h.01M12 15h.01" />
    </svg>
  );
}
