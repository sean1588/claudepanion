interface SketchProps {
  size?: number;
  color?: string;
}

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: color,
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Companion = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <path d="M10 14 Q10 10 14 10 L34 10 Q38 10 38 14 L38 30 Q38 34 34 34 L26 34 L22 39 L22 34 L14 34 Q10 34 10 30 Z" />
    <circle cx="20" cy="22" r="1.5" fill={color} />
    <circle cx="28" cy="22" r="1.5" fill={color} />
    <path d="M20 27 Q24 29 28 27" />
  </svg>
);

export const Form = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <rect x="9" y="8" width="30" height="34" rx="2" />
    <path d="M14 16 L34 16 M14 22 L28 22 M14 28 L34 28 M14 34 L24 34" />
    <rect x="29" y="32" width="8" height="6" rx="1" fill={color} fillOpacity="0.15" />
  </svg>
);

export const Slash = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <rect x="6" y="14" width="36" height="22" rx="2" />
    <path d="M14 22 L18 28 L14 34" />
    <path d="M22 34 L34 34" />
  </svg>
);

export const Wrench = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <path d="M30 8 a8 8 0 0 1 8 8 a8 8 0 0 1 -10 7.7 L12 40 a3 3 0 0 1 -4 -4 L24.3 20 A8 8 0 0 1 30 8 Z" />
    <circle cx="32" cy="16" r="2" fill={color} />
  </svg>
);

export const Doc = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <path d="M12 6 L30 6 L38 14 L38 42 L12 42 Z" />
    <path d="M30 6 L30 14 L38 14" />
    <path d="M17 22 L33 22 M17 28 L33 28 M17 34 L27 34" />
  </svg>
);

export const Plant = ({ size = 48, color = "currentColor" }: SketchProps) => (
  <svg {...base(size, color)}>
    <path d="M24 40 L24 22" />
    <path d="M24 28 Q14 24 14 14 Q22 16 24 24" />
    <path d="M24 24 Q34 20 34 12 Q26 14 24 22" />
    <path d="M16 40 L32 40 L30 44 L18 44 Z" />
  </svg>
);
