import { useState, type Dispatch, type SetStateAction } from "react";
import { VisionMiniBoard } from "./VisionMiniBoard";
import { visionGames } from "./visionMockData";
import type { VisionState } from "./visionState";

type GamesVisionProps = {
  setState: Dispatch<SetStateAction<VisionState>>;
};

export function GamesVision({ setState }: GamesVisionProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <section className="v2-vision-screen v2-vision-games" data-testid="v2-vision-games">
      <header className="v2-vision-games-hero" data-testid="v2-vision-games-source-room">
        <div className="v2-vision-games-hero-copy">
          <span className="v2-vision-kicker">Mes parties</span>
          <h2>D'où viennent tes décisions ?</h2>
          <p>Chaque partie devient une source de décisions à comprendre, rejouer et réviser.</p>
          <div className="v2-vision-source-stats" aria-label="Source Room stats">
            <span><strong>3</strong> parties importées</span>
            <span><strong>2</strong> Reviews prêtes</span>
            <span><strong>6</strong> exercices générés</span>
          </div>
        </div>
        <div className="v2-vision-games-hero-actions">
          <button
            className="v2-vision-primary"
            type="button"
            onClick={() => setImportOpen(true)}
            data-testid="v2-vision-import-pgn"
          >
            Importer PGN
          </button>
          <button className="v2-vision-secondary" type="button" data-testid="v2-vision-ready-reviews">
            Voir les Reviews prêtes
          </button>
        </div>
      </header>

      <div className="v2-vision-game-list">
        {visionGames.map((game) => (
          <article
            className={`v2-vision-game-card is-${game.tone}`}
            key={game.id}
            data-card-kind="source-room-card"
            data-testid={`v2-vision-game-${game.id}`}
          >
            <div className="v2-vision-source-room-card">
              <VisionMiniBoard
                fen={game.boardPreview.fen}
                highlightSquare={game.boardPreview.highlightSquare}
                arrow={game.boardPreview.arrow}
                size="md"
                mood={game.tone === "running" ? "active" : "calm"}
                label={game.boardPreview.label}
                testId={`v2-vision-game-preview-${game.id}`}
              />

              <div className="v2-vision-source-room-main">
                <header className="v2-vision-game-card-head">
                  <span className={`v2-vision-status is-${game.tone}`}>{game.status}</span>
                  <span>{game.date}</span>
                </header>

                <div className="v2-vision-game-copy">
                  <h3>{game.players}</h3>
                  <p>{game.result} · {game.userColor} · {game.score}</p>
                </div>

                <div className="v2-vision-learning-note v2-vision-source-key" data-testid={`v2-vision-game-moment-${game.id}`}>
                  <span>Moment clé</span>
                  <strong>{game.mainMoment}</strong>
                  <p>{game.learningUse}</p>
                </div>

                <div className="v2-vision-source-rail" aria-label="Résumé d'apprentissage">
                  <span>{game.moments}</span>
                  <span>{game.exercises}</span>
                  <span>{game.statusDetail}</span>
                </div>

                <div className="v2-vision-actions v2-vision-game-actions">
                  <button
                    className="v2-vision-card-primary"
                    type="button"
                    onClick={() => {
                      if (game.status !== "Review prête") {
                        return;
                      }
                      setState((current) => ({
                        ...current,
                        overlay: "decisionLab",
                        decisionMode: "summary",
                        linePlayerOpen: false,
                        detailsOpen: false,
                      }));
                    }}
                    data-testid={game.status === "Review prête" ? "v2-vision-open-review" : undefined}
                  >
                    {game.primaryAction}
                  </button>
                  <div className="v2-vision-game-secondary-actions">
                    <button className="v2-vision-ghost" type="button">Détails</button>
                    <button className="v2-vision-danger v2-vision-danger-subtle" type="button" onClick={() => setDeleteCandidate(game.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {deleteCandidate && (
        <div className="v2-vision-confirm" role="dialog" aria-modal="true" data-testid="v2-vision-delete-confirm">
          <div>
            <h3>Confirmation visuelle</h3>
            <p>Confirmation visuelle uniquement. Aucune donnée n'est supprimée.</p>
          </div>
          <button type="button" onClick={() => setDeleteCandidate(null)} data-testid="v2-vision-delete-cancel">
            Annuler
          </button>
        </div>
      )}

      {importOpen && (
        <div className="v2-vision-import-modal" role="dialog" aria-modal="true" data-testid="v2-vision-import-mock">
          <div className="v2-vision-import-panel">
            <header>
              <div>
                <span className="v2-vision-kicker">Import PGN</span>
                <h3>Ajouter une source de décisions</h3>
              </div>
              <button className="v2-vision-ghost" type="button" onClick={() => setImportOpen(false)} aria-label="Fermer import PGN">
                ×
              </button>
            </header>
            <textarea
              aria-label="PGN de démonstration"
              readOnly
              value={"[Event \"Partie de démonstration\"]\n1. d4 Nf6 2. c4 e6 3. Nc3 Bb4"}
            />
            <p>Cette prévisualisation ne crée aucune partie.</p>
            <div className="v2-vision-actions">
              <button className="v2-vision-primary" type="button">
                Analyser cette partie
              </button>
              <button className="v2-vision-ghost" type="button" onClick={() => setImportOpen(false)} data-testid="v2-vision-import-cancel">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
