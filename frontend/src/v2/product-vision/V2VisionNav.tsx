import type { Dispatch, SetStateAction } from "react";
import type { VisionMainTab } from "./visionMockData";
import type { VisionState } from "./visionState";

type V2VisionNavProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
};

const navItems: Array<{ id: VisionMainTab; label: string }> = [
  { id: "today", label: "Aujourd'hui" },
  { id: "games", label: "Mes parties" },
  { id: "training", label: "Entraînement" },
];

export function V2VisionNav({ state, setState }: V2VisionNavProps) {
  return (
    <nav className="v2-vision-nav" aria-label="Navigation principale" data-testid="v2-vision-main-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={state.mainTab === item.id && !state.overlay ? "is-active" : ""}
          type="button"
          onClick={() =>
            setState((current) => ({
              ...current,
              mainTab: item.id,
              overlay: null,
              detailsOpen: false,
              linePlayerOpen: false,
            }))
          }
          data-testid={`v2-vision-nav-${item.id}`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
