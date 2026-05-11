export function TodayHeroVisualPoster() {
  return (
    <svg
      className="v2-hero-visual-poster"
      viewBox="0 0 760 520"
      aria-hidden="true"
      focusable="false"
      data-testid="v2-hero-visual-poster"
    >
      <defs>
        <radialGradient id="v2PosterGlow" cx="52%" cy="46%" r="56%">
          <stop offset="0%" stopColor="rgba(94, 234, 212, 0.26)" />
          <stop offset="46%" stopColor="rgba(125, 211, 252, 0.08)" />
          <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
        </radialGradient>
        <linearGradient id="v2PosterLine" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(125, 211, 252, 0.02)" />
          <stop offset="52%" stopColor="rgba(94, 234, 212, 0.32)" />
          <stop offset="100%" stopColor="rgba(251, 191, 36, 0.12)" />
        </linearGradient>
      </defs>
      <rect width="760" height="520" fill="url(#v2PosterGlow)" />
      <g className="v2-constellation-poster-grid" opacity="0.16">
        <path d="M88 130h178v178H88zM118 160h118v118H118z" />
        <path d="M560 88h86v86h-86zM586 114h34v34h-34z" />
      </g>
      <g className="v2-constellation-links">
        <path d="M116 348 C190 286, 242 256, 324 272 S458 232, 572 142" />
        <path d="M178 172 C248 114, 328 148, 396 224 S504 336, 632 298" />
        <path d="M264 392 C344 340, 420 362, 506 418" />
      </g>
      <g className="v2-constellation-rings">
        <ellipse cx="402" cy="258" rx="184" ry="74" />
        <ellipse cx="402" cy="258" rx="116" ry="186" transform="rotate(-36 402 258)" />
      </g>
      <g className="v2-constellation-nodes">
        {[
          [116, 348, 5],
          [178, 172, 4],
          [264, 392, 4],
          [324, 272, 7],
          [396, 224, 4],
          [506, 418, 5],
          [572, 142, 6],
          [632, 298, 4],
        ].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
      </g>
    </svg>
  );
}
