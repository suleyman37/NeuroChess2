import { useEffect, useState } from "react";

import { getCapabilities, type CapabilityTab } from "../../api/client";
import { REVIEW_FOCUS_TABS } from "./reviewLabels";
import type { ReviewFocusKey } from "./reviewTypes";

type ReviewFocusTab = {
  key: ReviewFocusKey;
  label: string;
};

const CAPABILITY_TAB_ID_TO_FOCUS_KEY: Record<string, ReviewFocusKey> = {
  summary: "summary",
  learn: "learn",
  practice: "practice",
  explorer: "lab",
};

const REQUIRED_REVIEW_FOCUS_KEYS: ReviewFocusKey[] = ["summary", "learn", "practice", "lab"];

let cachedReviewFocusTabs: ReviewFocusTab[] | null = null;
let pendingReviewFocusTabsRequest: Promise<ReviewFocusTab[]> | null = null;

function normalizeCapabilityReviewTabs(tabs: unknown): ReviewFocusTab[] {
  if (!Array.isArray(tabs)) {
    return REVIEW_FOCUS_TABS;
  }

  const normalized: ReviewFocusTab[] = [];
  const seen = new Set<ReviewFocusKey>();

  for (const tab of tabs) {
    if (!tab || typeof tab !== "object") {
      continue;
    }

    const candidate = tab as Partial<CapabilityTab>;
    const key = candidate.id ? CAPABILITY_TAB_ID_TO_FOCUS_KEY[candidate.id] : null;
    if (!key || seen.has(key) || typeof candidate.label !== "string" || candidate.label.length === 0) {
      continue;
    }

    normalized.push({ key, label: candidate.label });
    seen.add(key);
  }

  const hasRequiredTabs = REQUIRED_REVIEW_FOCUS_KEYS.every((key) => seen.has(key));
  return hasRequiredTabs ? normalized : REVIEW_FOCUS_TABS;
}

function loadReviewFocusTabs(): Promise<ReviewFocusTab[]> {
  if (cachedReviewFocusTabs) {
    return Promise.resolve(cachedReviewFocusTabs);
  }

  if (!pendingReviewFocusTabsRequest) {
    pendingReviewFocusTabsRequest = getCapabilities()
      .then((capabilities) => normalizeCapabilityReviewTabs(capabilities.review?.tabs))
      .catch(() => REVIEW_FOCUS_TABS)
      .then((tabs) => {
        cachedReviewFocusTabs = tabs;
        return tabs;
      })
      .finally(() => {
        pendingReviewFocusTabsRequest = null;
      });
  }

  return pendingReviewFocusTabsRequest;
}

export function ReviewFocusTabs({
  activeFocus,
  onFocusChange,
}: {
  activeFocus: ReviewFocusKey;
  onFocusChange: (focus: ReviewFocusKey) => void;
}) {
  const [tabs, setTabs] = useState<ReviewFocusTab[]>(() => cachedReviewFocusTabs ?? REVIEW_FOCUS_TABS);

  useEffect(() => {
    let cancelled = false;

    loadReviewFocusTabs().then((loadedTabs) => {
      if (!cancelled) {
        setTabs(loadedTabs);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="review-focus-tabs review-main-navigation" role="tablist" aria-label="Navigation Review">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          data-testid={`review-focus-${tab.key}`}
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

