import type { Dispatch, SetStateAction } from "react";
import type { VisionState } from "./visionState";
import { getVisionTitle } from "./visionState";

type V2VisionHeaderProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onExit?: () => void;
};

export function V2VisionHeader({ state, setState, onExit }: V2VisionHeaderProps) {
  return (
    <header className="v2-vision-header" data-testid="v2-vision-header">
      <div className="v2-vision-brand">
        <span className="v2-vision-brand-mark" aria-hidden="true">N</span>
        <div>
          <h1>NeuroChess</h1>
          <span className="v2-vision-dev-badge" title="Prototype local de validation visuelle">Prototype</span>
        </div>
      </div>
      <div className="v2-vision-header-center" data-current-view={getVisionTitle(state)}>
        <span>{getVisionTitle(state)}</span>
        <span>Carnet de décisions</span>
      </div>
      <div className="v2-vision-header-actions" aria-label="Accès secondaires">
        <button
          className="v2-vision-header-secondary"
          type="button"
          onClick={() => setState((current) => ({ ...current, overlay: "progression" }))}
          data-testid="v2-vision-open-progression"
        >
          Progression
        </button>
        <button
          className="v2-vision-header-secondary"
          type="button"
          onClick={() => setState((current) => ({ ...current, overlay: "profile" }))}
          data-testid="v2-vision-open-profile"
        >
          Profil / Paramètres
        </button>
        {onExit && (
          <button className="v2-vision-exit" type="button" onClick={onExit} data-testid="v2-vision-exit">
            Retour V1
          </button>
        )}
      </div>
    </header>
  );
}
