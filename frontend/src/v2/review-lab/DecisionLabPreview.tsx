import { DecisionLabShell } from "./DecisionLabShell";
import "./decisionLab.css";

type DecisionLabPreviewProps = {
  onExit?: () => void;
};

export function DecisionLabPreview({ onExit }: DecisionLabPreviewProps) {
  return <DecisionLabShell onExit={onExit} />;
}
