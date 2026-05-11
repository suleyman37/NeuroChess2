import type { Dispatch, SetStateAction } from "react";
import { DecisionLabVision } from "./DecisionLabVision";
import { ExplorerVision } from "./ExplorerVision";
import { GamesVision } from "./GamesVision";
import { PracticeVision } from "./PracticeVision";
import { ProfileVision } from "./ProfileVision";
import { ProgressionVision } from "./ProgressionVision";
import { TodayVision } from "./TodayVision";
import { TrainingVision } from "./TrainingVision";
import { V2VisionHeader } from "./V2VisionHeader";
import { V2VisionNav } from "./V2VisionNav";
import { VisionDetailsDrawer } from "./VisionDetailsDrawer";
import type { VisionState } from "./visionState";

type V2VisionShellProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onExit?: () => void;
};

export function V2VisionShell({ state, setState, onExit }: V2VisionShellProps) {
  const activeScreen = state.overlay ?? state.mainTab;
  const activeView = state.overlay ? `overlay-${state.overlay}` : `tab-${state.mainTab}`;

  const closeOverlay = () =>
    setState((current) => ({
      ...current,
      overlay: null,
      detailsOpen: false,
      linePlayerOpen: false,
      profileDeleteConfirm: false,
    }));

  let content = null;
  if (state.overlay === "decisionLab") {
    content = <DecisionLabVision state={state} setState={setState} onBack={closeOverlay} />;
  } else if (state.overlay === "practice") {
    content = <PracticeVision state={state} setState={setState} onBack={closeOverlay} />;
  } else if (state.overlay === "explorer") {
    content = <ExplorerVision state={state} setState={setState} onBack={closeOverlay} />;
  } else if (state.overlay === "progression") {
    content = <ProgressionVision onBack={closeOverlay} />;
  } else if (state.overlay === "profile") {
    content = <ProfileVision state={state} setState={setState} onBack={closeOverlay} />;
  } else if (state.mainTab === "games") {
    content = <GamesVision setState={setState} />;
  } else if (state.mainTab === "training") {
    content = <TrainingVision setState={setState} />;
  } else {
    content = <TodayVision setState={setState} />;
  }

  return (
    <main
      className="v2-vision-app"
      data-density="desktop"
      data-prototype="v2-product-vision"
      data-screen={activeScreen}
      data-testid="v2-vision-app"
      data-view={activeView}
    >
      <V2VisionHeader state={state} setState={setState} onExit={onExit} />
      <V2VisionNav state={state} setState={setState} />
      <section className="v2-vision-workspace" data-testid="v2-vision-workspace">
        {content}
      </section>
      <VisionDetailsDrawer
        open={state.detailsOpen}
        momentId={state.selectedMomentId}
        onClose={() => setState((current) => ({ ...current, detailsOpen: false }))}
      />
    </main>
  );
}
