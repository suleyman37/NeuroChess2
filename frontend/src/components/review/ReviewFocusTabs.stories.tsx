import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ReviewFocusTabs } from "./ReviewFocusTabs";
import type { ReviewFocusKey } from "./reviewTypes";

const capabilitiesResponse = {
  schema_version: "capabilities_manifest_v1",
  product: {
    name: "NeuroChess 2",
  },
  review: {
    tabs: [
      { id: "summary", label: "Résumé", screen_id: "app.review.summary" },
      { id: "learn", label: "Apprendre", screen_id: "app.review.learn.challenge" },
      { id: "practice", label: "S'entraîner", screen_id: "app.review.training" },
      { id: "explorer", label: "Explorer", screen_id: "app.review.explorer" },
    ],
  },
};

declare global {
  interface Window {
    __neuroChessStorybookCapabilitiesMock?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__neuroChessStorybookCapabilitiesMock) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    if (url.includes("/capabilities")) {
      return Promise.resolve(
        new Response(JSON.stringify(capabilitiesResponse), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }

    return originalFetch(input, init);
  };

  window.__neuroChessStorybookCapabilitiesMock = true;
}

function ReviewFocusTabsPlayground() {
  const [activeFocus, setActiveFocus] = useState<ReviewFocusKey>("summary");

  return (
    <div style={{ minHeight: "100vh", padding: 32, background: "#08111f" }}>
      <ReviewFocusTabs activeFocus={activeFocus} onFocusChange={setActiveFocus} />
    </div>
  );
}

const meta = {
  title: "Review/ReviewFocusTabs",
  component: ReviewFocusTabs,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ReviewFocusTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ReviewFocusTabsPlayground />,
};
