import { useState } from "react";
import { RexPrototypeBadge } from "./components/RexPrototypeBadge";
import { RexNav } from "./RexNav";
import { rexSurfaceCopies } from "./rexCopy";
import type { RexSurfaceId } from "./rexTypes";
import { ArenaSurface } from "./surfaces/ArenaSurface";
import { ForgeSurface } from "./surfaces/ForgeSurface";
import { PartiesSurface } from "./surfaces/PartiesSurface";
import { ProfileSurface } from "./surfaces/ProfileSurface";
import { QGSurface } from "./surfaces/QGSurface";

function renderSurface(surface: RexSurfaceId) {
  switch (surface) {
    case "qg":
      return <QGSurface />;
    case "parties":
      return <PartiesSurface />;
    case "forge":
      return <ForgeSurface />;
    case "arene":
      return <ArenaSurface />;
    case "profil":
      return <ProfileSurface />;
    default:
      return <QGSurface />;
  }
}

export function RexShell() {
  const [activeSurface, setActiveSurface] = useState<RexSurfaceId>("qg");
  const activeTone = rexSurfaceCopies[activeSurface].tone;

  return (
    <main className="rex-shell" data-testid="rex-shell" data-active-tone={activeTone}>
      <header className="rex-shell__header">
        <div>
          <RexPrototypeBadge compact />
          <p className="rex-shell__kicker">NeuroChess REX</p>
          <h1>Command Center</h1>
          <p>
            Cinq surfaces pour tester le futur RPG de progression échiquéenne, sans vraie
            métrique et sans logique backend nouvelle.
          </p>
        </div>
        <div className="rex-shell__doctrine" aria-label="Doctrine REX">
          <strong>Décision jugée franchement. Joueur respecté.</strong>
          <span>Le système juge la décision, pas le joueur.</span>
        </div>
      </header>

      <RexNav activeSurface={activeSurface} onSelectSurface={setActiveSurface} />

      <div className="rex-shell__content">{renderSurface(activeSurface)}</div>
    </main>
  );
}
