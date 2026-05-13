import { RexDesignLab } from "./design-lab/RexDesignLab";
import { RexShell } from "./RexShell";
import "./rexStyles.css";

function shouldShowDesignLab() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("designLab") === "1";
}

export function RexApp() {
  if (shouldShowDesignLab()) {
    return <RexDesignLab />;
  }

  return <RexShell />;
}
