import {
  REX_DESIGN_DIRECTION_IDS,
  rexDesignDirections,
  type RexDesignDirectionId,
} from "./designDirections";

interface RexDesignLabNavProps {
  activeDirection: RexDesignDirectionId;
  onSelect: (directionId: RexDesignDirectionId) => void;
}

export function RexDesignLabNav({ activeDirection, onSelect }: RexDesignLabNavProps) {
  return (
    <nav className="rex-design-lab-nav" data-testid="rex-design-lab-nav" aria-label="Directions visuelles REX">
      {REX_DESIGN_DIRECTION_IDS.map((directionId) => {
        const direction = rexDesignDirections[directionId];
        const isActive = activeDirection === directionId;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className="rex-design-lab-nav__button"
            data-testid={`rex-design-direction-${directionId}`}
            data-state={isActive ? "active" : "idle"}
            key={directionId}
            onClick={() => onSelect(directionId)}
            type="button"
          >
            <span>{direction.navLabel}</span>
            <small>{direction.tagline}</small>
          </button>
        );
      })}
    </nav>
  );
}

