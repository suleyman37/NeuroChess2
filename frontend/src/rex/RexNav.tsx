import type { CSSProperties } from "react";
import { REX_SURFACE_IDS, type RexSurfaceId } from "./rexTypes";
import { rexSurfaceCopies } from "./rexCopy";

type RexNavProps = {
  activeSurface: RexSurfaceId;
  onSelectSurface: (surface: RexSurfaceId) => void;
};

const navTestIds: Record<RexSurfaceId, string> = {
  qg: "rex-nav-qg",
  parties: "rex-nav-parties",
  forge: "rex-nav-forge",
  arene: "rex-nav-arene",
  profil: "rex-nav-profil",
};

export function RexNav({ activeSurface, onSelectSurface }: RexNavProps) {
  const activeIndex = REX_SURFACE_IDS.indexOf(activeSurface);
  const navStyle = { "--rex-active-index": activeIndex } as CSSProperties;

  return (
    <nav
      className="rex-nav"
      data-testid="rex-nav"
      aria-label="Navigation REX"
      data-active-surface={activeSurface}
      style={navStyle}
    >
      {REX_SURFACE_IDS.map((surfaceId) => {
        const copy = rexSurfaceCopies[surfaceId];
        const isActive = surfaceId === activeSurface;
        return (
          <button
            key={surfaceId}
            type="button"
            className={isActive ? "rex-nav__item active" : "rex-nav__item"}
            data-testid={navTestIds[surfaceId]}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelectSurface(surfaceId)}
          >
            {copy.navLabel}
          </button>
        );
      })}
    </nav>
  );
}
