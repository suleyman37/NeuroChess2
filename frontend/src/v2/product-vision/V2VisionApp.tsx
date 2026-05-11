import { useState } from "react";
import { V2VisionShell } from "./V2VisionShell";
import { initialVisionState, type VisionState } from "./visionState";
import "./productVision.css";

type V2VisionAppProps = {
  onExit?: () => void;
};

export function V2VisionApp({ onExit }: V2VisionAppProps) {
  const [state, setState] = useState<VisionState>(initialVisionState);

  return (
    <V2VisionShell
      state={state}
      setState={setState}
      onExit={onExit}
    />
  );
}
