import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function makeBase({ size = 48, ...rest }: IconProps) {
  return {
    width: size, height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

const Companion = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M10 30c0-7 6-13 14-13s14 6 14 13c0 4-2 7-5 9l1 6-7-4c-1 0-2 0-3 0-8 0-14-5-14-11Z"/>
    <circle cx="18" cy="29" r="1.2" fill="currentColor"/>
    <circle cx="24" cy="29" r="1.2" fill="currentColor"/>
    <circle cx="30" cy="29" r="1.2" fill="currentColor"/>
  </svg>
);

const Form = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <rect x="10" y="8" width="28" height="32" rx="2"/>
    <path d="M16 16h16M16 22h16M16 28h10"/>
  </svg>
);

const Slash = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M18 8 L30 40"/>
    <path d="M10 24h28"/>
  </svg>
);

const Wrench = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M30 8a8 8 0 0 0-8 10l-12 12a3 3 0 0 0 4 4l12-12a8 8 0 0 0 10-8l-6 6-4-1-1-4Z"/>
  </svg>
);

const Doc = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M12 6h18l8 8v28H12Z"/>
    <path d="M30 6v8h8"/>
    <path d="M18 22h12M18 28h12M18 34h8"/>
  </svg>
);

const Plant = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <path d="M14 40h20"/>
    <path d="M24 40V20"/>
    <path d="M24 26c-6 0-10-4-10-10 6 0 10 4 10 10Z"/>
    <path d="M24 22c6 0 10-4 10-10-6 0-10 4-10 10Z"/>
  </svg>
);

const Search = (p: IconProps) => (
  <svg {...makeBase(p)}>
    <circle cx="22" cy="22" r="10"/>
    <path d="M30 30l8 8"/>
  </svg>
);

export const Sketch = { Companion, Form, Slash, Wrench, Doc, Plant, Search };
