import { RexDesignLab } from "./design-lab/RexDesignLab";
import { RexFxLab } from "./fx-lab/RexFxLab";
import { RexShell } from "./RexShell";
import "./rexStyles.css";

function shouldShowDesignLab() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("designLab") === "1";
}

function shouldShowFxLab() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("fxLab") === "1";
}

export function RexApp() {
  if (shouldShowFxLab()) {
    return <RexFxLab />;
  }

  if (shouldShowDesignLab()) {
    return <RexDesignLab />;
  }

  return <RexShell />;
}
