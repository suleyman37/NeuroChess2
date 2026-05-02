import { REVIEW_FOCUS_TABS } from "./reviewLabels";
import type { ReviewFocusKey } from "./reviewTypes";

export function ReviewFocusTabs({
  activeFocus,
  onFocusChange,
}: {
  activeFocus: ReviewFocusKey;
  onFocusChange: (focus: ReviewFocusKey) => void;
}) {
  return (
    <div className="review-focus-tabs review-main-navigation" role="tablist" aria-label="Navigation Review">
      {REVIEW_FOCUS_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          className={`review-focus-tab ${activeFocus === tab.key ? "active" : ""}`}
          aria-selected={activeFocus === tab.key}
          onClick={() => onFocusChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

