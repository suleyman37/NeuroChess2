import type { MouseEvent } from "react";

export type NeuroChessLogoVariant = "light" | "dark" | "compact" | "header";

type NeuroChessLogoProps = {
  variant?: NeuroChessLogoVariant;
  href?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function NeuroChessLogo({
  variant = "light",
  href = "/",
  className = "",
  onClick,
}: NeuroChessLogoProps) {
  const classes = ["neuro-logo", `neuro-logo-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      aria-label="Retour à l'accueil NeuroChess"
      className={classes}
      href={href}
      onClick={onClick}
    >
      <span className="neuro-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" role="img">
          <path
            className="neuro-logo-hex"
            d="M22 3.8 37.8 12.9v18.2L22 40.2 6.2 31.1V12.9L22 3.8Z"
          />
          <path className="neuro-logo-board" d="M15 16h14v14H15z" />
          <path className="neuro-logo-board-cut" d="M22 16v14M15 23h14" />
          <path className="neuro-logo-link" d="M14 14 22 23l8-9M14 32l8-9 8 9" />
          <circle className="neuro-logo-node" cx="14" cy="14" r="2.2" />
          <circle className="neuro-logo-node" cx="30" cy="14" r="2.2" />
          <circle className="neuro-logo-node" cx="22" cy="23" r="2.4" />
          <circle className="neuro-logo-node" cx="14" cy="32" r="2.2" />
          <circle className="neuro-logo-node" cx="30" cy="32" r="2.2" />
        </svg>
      </span>
      <span className="neuro-logo-copy">
        <span className="neuro-logo-name">NeuroChess</span>
        {variant !== "compact" && (
          <span className="neuro-logo-subtitle">
            {variant === "header" ? "Chess • Decision Science" : "Chess x Decision Science"}
          </span>
        )}
      </span>
    </a>
  );
}
