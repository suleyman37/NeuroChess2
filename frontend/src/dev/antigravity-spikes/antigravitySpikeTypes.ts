import type { ComponentType } from "react";

export type AntigravitySpikeStatus =
  | "awaiting_revision"
  | "proposal_ready"
  | "accepted_dev_only"
  | "disabled";

export type AntigravitySpikeComponentProps = {
  spike: AntigravitySpikeDefinition;
};

export type AntigravitySpikeComponent = ComponentType<AntigravitySpikeComponentProps>;

export type AntigravitySpikeDefinition = {
  id: string;
  routeParam: string;
  title: string;
  description: string;
  status: AntigravitySpikeStatus;
  objective: string;
  allowedPaths: string[];
  expectedOutputs: string[];
  componentLoader?: () => Promise<{ default: AntigravitySpikeComponent }>;
};

export type AntigravitySpikeHostRoute = {
  spikeId: string;
};
