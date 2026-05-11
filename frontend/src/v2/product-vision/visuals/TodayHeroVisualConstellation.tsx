type TodayHeroVisualConstellationProps = {
  motion: "full" | "paused";
};

const nodes = [
  { id: "game", x: 92, y: 330, r: 5, depth: "far" },
  { id: "review", x: 150, y: 176, r: 4, depth: "far" },
  { id: "choice", x: 254, y: 382, r: 5, depth: "near" },
  { id: "pivot", x: 334, y: 260, r: 8, depth: "core" },
  { id: "try", x: 416, y: 206, r: 4, depth: "near" },
  { id: "return", x: 486, y: 410, r: 5, depth: "far" },
  { id: "memory", x: 570, y: 130, r: 6, depth: "near" },
  { id: "line", x: 636, y: 292, r: 4, depth: "far" },
  { id: "quiet", x: 704, y: 206, r: 3, depth: "far" },
];

export function TodayHeroVisualConstellation({ motion }: TodayHeroVisualConstellationProps) {
  return (
    <svg
      className="v2-hero-visual-constellation"
      viewBox="0 0 760 520"
      aria-hidden="true"
      focusable="false"
      data-testid="v2-hero-visual-constellation"
      data-motion={motion}
    >
      <defs>
        <radialGradient id="v2ConstellationGlow" cx="50%" cy="48%" r="54%">
          <stop offset="0%" stopColor="rgba(94, 234, 212, 0.3)" />
          <stop offset="44%" stopColor="rgba(14, 165, 233, 0.1)" />
          <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
        </radialGradient>
        <linearGradient id="v2ConstellationLine" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(125, 211, 252, 0.05)" />
          <stop offset="48%" stopColor="rgba(94, 234, 212, 0.42)" />
          <stop offset="100%" stopColor="rgba(251, 191, 36, 0.16)" />
        </linearGradient>
      </defs>
      <rect width="760" height="520" fill="url(#v2ConstellationGlow)" />
      <g className="v2-constellation-depth is-back">
        <path className="v2-constellation-board-echo" d="M78 116h184v184H78zM124 116v184M170 116v184M216 116v184M78 162h184M78 208h184M78 254h184" />
        <path className="v2-constellation-piece-echo" d="M590 84c28 14 42 33 42 58 0 22-12 39-37 53 26 11 41 29 44 54-32-19-67-24-106-15 31-26 40-52 27-78-11-21-5-45 30-72z" />
      </g>
      <g className="v2-constellation-rings is-orbit">
        <ellipse cx="396" cy="258" rx="198" ry="78" />
        <ellipse cx="396" cy="258" rx="116" ry="198" transform="rotate(-36 396 258)" />
      </g>
      <g className="v2-constellation-links is-links">
        <path d="M92 330 C178 274, 236 246, 334 260 S472 218, 570 130" />
        <path d="M150 176 C238 104, 330 142, 416 206 S526 318, 636 292" />
        <path d="M254 382 C328 322, 404 340, 486 410" />
        <path d="M334 260 C410 278, 468 236, 570 130" />
        <path className="v2-constellation-return-trace" d="M636 292 C548 328, 446 310, 334 260" />
      </g>
      <g className="v2-constellation-nodes is-nodes">
        {nodes.map((node) => (
          <circle
            className={`v2-constellation-node is-${node.depth}`}
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.r}
          />
        ))}
      </g>
      <g className="v2-constellation-signal">
        <circle cx="334" cy="260" r="16" />
        <path d="M334 260 C388 242, 456 210, 570 130" />
      </g>
    </svg>
  );
}
