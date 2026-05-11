import { useMemo, useState } from "react";
import { DecisionActions } from "./DecisionActions";
import { DecisionBoard } from "./DecisionBoard";
import { DecisionCard } from "./DecisionCard";
import { DecisionPath } from "./DecisionPath";
import { DeepDiveDrawer } from "./DeepDiveDrawer";
import { LinePlaybackDock } from "./LinePlaybackDock";
import {
  decisionLabModes,
  decisionLabMoments,
  type DecisionLabFilter,
  type DecisionLabMode,
} from "./decisionLabMockData";
import {
  filterDecisionMoments,
  getDecisionFilterLabel,
  getPrimaryDecisionAction,
  type DecisionLabExplorerResult,
  type DecisionLabReplayPhase,
} from "./decisionLabState";

type DecisionLabShellProps = {
  onExit?: () => void;
};

const decisionLabFilterIds: DecisionLabFilter[] = ["priority", "review", "good", "all"];

export function DecisionLabShell({ onExit }: DecisionLabShellProps) {
  const [activeMode, setActiveMode] = useState<DecisionLabMode>("summary");
  const [activeFilter, setActiveFilter] = useState<DecisionLabFilter>("priority");
  const [selectedMomentId, setSelectedMomentId] = useState(decisionLabMoments[0].id);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [linePlayerOpen, setLinePlayerOpen] = useState(false);
  const [linePlayerSource, setLinePlayerSource] = useState<"played" | "solution">("played");
  const [lineStep, setLineStep] = useState(0);
  const [replayPhase, setReplayPhase] = useState<DecisionLabReplayPhase>("idle");
  const [explorerResult, setExplorerResult] = useState<DecisionLabExplorerResult>("none");
  const [analysisPreset, setAnalysisPreset] = useState<"fast" | "standard" | "deep">("standard");

  const selectedMoment =
    decisionLabMoments.find((moment) => moment.id === selectedMomentId) ?? decisionLabMoments[0];
  const filteredMoments = useMemo(
    () => filterDecisionMoments(decisionLabMoments, activeFilter),
    [activeFilter],
  );
  const visibleMoments = filteredMoments.slice(0, 5);
  const filterCounts = useMemo(
    () =>
      decisionLabFilterIds.reduce<Record<DecisionLabFilter, number>>((counts, filter) => {
        counts[filter] = filterDecisionMoments(decisionLabMoments, filter).length;
        return counts;
      }, { priority: 0, review: 0, good: 0, all: 0 }),
    [],
  );
  const primaryAction = getPrimaryDecisionAction(
    {
      mode: activeMode,
      selectedMomentId,
      filter: activeFilter,
      deepDiveOpen,
      linePlayerOpen,
      replayPhase,
      explorerResult,
    },
    selectedMoment,
  );
  const activeModeConfig = decisionLabModes.find((mode) => mode.id === activeMode) ?? decisionLabModes[0];

  const selectMode = (mode: DecisionLabMode) => {
    setActiveMode(mode);
    setLinePlayerOpen(false);
    if (mode !== "replay") {
      setReplayPhase("idle");
    }
    if (mode !== "explore") {
      setExplorerResult("none");
    }
  };

  const selectFilter = (filter: DecisionLabFilter) => {
    setActiveFilter(filter);
    const nextMoments = filterDecisionMoments(decisionLabMoments, filter);
    if (nextMoments.length > 0 && !nextMoments.some((moment) => moment.id === selectedMomentId)) {
      setSelectedMomentId(nextMoments[0].id);
    }
  };

  const selectMoment = (momentId: string) => {
    setSelectedMomentId(momentId);
    setReplayPhase("idle");
    setExplorerResult("none");
    setLinePlayerOpen(false);
  };

  const openLinePlayer = (source: "played" | "solution" = "played") => {
    setLinePlayerSource(source);
    setLineStep(0);
    setLinePlayerOpen(true);
  };

  const selectNextReplayableMoment = () => {
    const replayable = decisionLabMoments.filter((moment) => moment.canReplay || moment.canPractice);
    if (replayable.length === 0) {
      setReplayPhase("idle");
      return;
    }
    const currentIndex = replayable.findIndex((moment) => moment.id === selectedMoment.id);
    const nextMoment = replayable[(currentIndex + 1 + replayable.length) % replayable.length];
    selectMoment(nextMoment.id);
    setActiveMode("replay");
    setReplayPhase("idle");
  };

  const handlePrimaryAction = () => {
    if (!primaryAction.enabled) return;
    if (primaryAction.handlerKey === "start_replay") {
      if (activeMode === "replay") {
        setReplayPhase("attempting");
      } else {
        selectMode("replay");
      }
      return;
    }
    if (primaryAction.handlerKey === "validate_attempt") {
      setReplayPhase("feedback");
      return;
    }
    if (primaryAction.handlerKey === "next_position") {
      selectNextReplayableMoment();
      return;
    }
    if (primaryAction.handlerKey === "open_explorer") {
      selectMode("explore");
      return;
    }
    if (primaryAction.handlerKey === "open_line") {
      openLinePlayer("played");
      return;
    }
    if (primaryAction.handlerKey === "analyze_move") {
      setExplorerResult("move");
      return;
    }
    if (primaryAction.handlerKey === "analyze_line") {
      setExplorerResult("line");
    }
  };

  return (
    <main className="decision-lab-shell" data-testid="decision-lab-shell">
      <header className="decision-lab-header" data-testid="decision-lab-header">
        <div>
          <span className="decision-lab-kicker">Prototype DEV-only</span>
          <h1>Decision Lab</h1>
        </div>
        <div className="decision-lab-header-actions">
          <span>Review V2 statique</span>
          {onExit && (
            <button
              className="decision-lab-ghost-button"
              type="button"
              onClick={onExit}
              data-testid="decision-lab-exit"
            >
              Retour V1
            </button>
          )}
        </div>
      </header>

      <section className="decision-lab-grid" aria-label="Decision Lab Review V2">
        <DecisionPath
          activeMode={activeMode}
          activeFilter={activeFilter}
          filters={decisionLabFilterIds.map((filter) => ({
            id: filter,
            label: getDecisionFilterLabel(filter),
            count: filterCounts[filter],
          }))}
          moments={visibleMoments}
          allMoments={decisionLabMoments}
          selectedMoment={selectedMoment}
          selectedMomentId={selectedMoment.id}
          filterCount={filterCounts[activeFilter]}
          replayPhase={replayPhase}
          explorerResult={explorerResult}
          onSelectFilter={selectFilter}
          onSelectMoment={selectMoment}
        />

        <section className="decision-lab-stage" data-testid="decision-lab-stage">
          <div className="decision-lab-mode-switch" aria-label="Modes Decision Lab">
            {decisionLabModes.map((mode) => (
              <button
                key={mode.id}
                className={activeMode === mode.id ? "is-active" : ""}
                type="button"
                onClick={() => selectMode(mode.id)}
                data-testid={`decision-lab-mode-${mode.id}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="decision-lab-mode-hint" data-testid="decision-lab-mode-hint">
            {activeModeConfig.hint}
          </p>

          <DecisionBoard moment={selectedMoment} activeMode={activeMode} />

          {linePlayerOpen ? (
            <LinePlaybackDock
              moment={selectedMoment}
              source={linePlayerSource}
              stepIndex={lineStep}
              onChangeSource={setLinePlayerSource}
              onPrevious={() => setLineStep((value) => Math.max(0, value - 1))}
              onNext={() => setLineStep((value) => Math.min(selectedMoment.line.length - 1, value + 1))}
              onReplay={() => setLineStep(0)}
              onClose={() => setLinePlayerOpen(false)}
            />
          ) : (
            <DecisionActions
              activeMode={activeMode}
              moment={selectedMoment}
              primaryAction={primaryAction}
              analysisPreset={analysisPreset}
              explorerResult={explorerResult}
              replayPhase={replayPhase}
              onPrimaryAction={handlePrimaryAction}
              onOpenLine={() => openLinePlayer("played")}
              onOpenExplore={() => selectMode("explore")}
              onOpenReplay={() => selectMode("replay")}
              onAnalyzeMove={() => setExplorerResult("move")}
              onAnalyzeLine={() => setExplorerResult("line")}
              onPresetChange={setAnalysisPreset}
              onResetExplorer={() => setExplorerResult("none")}
              onReturnToSummary={() => selectMode("summary")}
              onReplayHint={() => setReplayPhase("attempting")}
              onReplayCorrection={() => setReplayPhase("feedback")}
              onReplayRetry={() => setReplayPhase("idle")}
            />
          )}
        </section>

        <DecisionCard
          activeMode={activeMode}
          moment={selectedMoment}
          explorerResult={explorerResult}
          replayPhase={replayPhase}
          onOpenDetails={() => setDeepDiveOpen(true)}
        />
      </section>

      <DeepDiveDrawer open={deepDiveOpen} moment={selectedMoment} onClose={() => setDeepDiveOpen(false)} />
    </main>
  );
}
