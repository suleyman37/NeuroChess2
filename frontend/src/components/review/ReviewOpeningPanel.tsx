import type { OpeningRealityEvidence } from "../../api/client";
import { OPENING_FALLBACK_MESSAGES, openingRealityConfidenceLabel } from "./reviewLabels";
import { buildOpeningRealityView } from "./reviewViewModel";
import { openingLinkedMomentLabel, openingMoveLabel, openingSanLabel } from "./reviewUtils";

function OpeningRealityCard({
  evidence,
  intentionNote,
  onIntentionNoteChange,
  onShowOpeningExit,
  onShowOpeningLinkedMoment,
}: {
  evidence: OpeningRealityEvidence | null;
  intentionNote: string;
  onIntentionNoteChange: (note: string) => void;
  onShowOpeningExit: (evidence: OpeningRealityEvidence) => void;
  onShowOpeningLinkedMoment: (ply: number, evidence?: OpeningRealityEvidence) => void;
}) {
  if (!evidence) {
    return null;
  }

  const { linkedMoment, canReviewExit, canShowLinkedMoment } = buildOpeningRealityView(evidence);

  if (evidence.status === "not_applicable_from_position") {
    return (
      <section className="review-opening-reality compact" aria-label="Réalité de l'ouverture">
        <div className="review-block-title">
          <span>Réalité de l'ouverture</span>
          <strong>spéciale</strong>
        </div>
        <p>Ouverture non applicable — position initiale spéciale.</p>
      </section>
    );
  }

  if (!evidence.available) {
    return (
      <section className="review-opening-reality compact" aria-label="Réalité de l'ouverture">
        <div className="review-block-title">
          <span>Réalité de l'ouverture</span>
          <strong>à compléter</strong>
        </div>
        <p>
          {evidence.summary ??
            "Données d'ouverture insuffisantes pour établir un diagnostic fiable."}
        </p>
      </section>
    );
  }

  return (
    <section className="review-opening-reality" aria-label="Réalité de l'ouverture">
      <div className="review-block-title">
        <span>Réalité de l'ouverture</span>
        <strong>{openingRealityConfidenceLabel(evidence.confidence)}</strong>
      </div>
      <div className="review-opening-grid">
        <div>
          <span>Ouverture</span>
          <strong>
            {evidence.opening_name ?? "non classifiée"}
            {evidence.eco ? ` · ${evidence.eco}` : ""}
          </strong>
        </div>
        <div>
          <span>Dernier coup de livre</span>
          <strong>
            {typeof (evidence.last_book_ply ?? evidence.book_until_ply) === "number"
              ? `jusqu'au ${openingMoveLabel(evidence.last_book_ply ?? evidence.book_until_ply ?? 0)}`
              : "limite inconnue"}
          </strong>
        </div>
        <div>
          <span>Coup de sortie</span>
          <strong>
            {typeof (evidence.exit_ply ?? evidence.out_of_book_ply) === "number"
              ? `${openingMoveLabel(evidence.exit_ply ?? evidence.out_of_book_ply ?? 0)} — ${openingSanLabel(
                  evidence.exit_move_san ?? evidence.out_of_book_move_san,
                  evidence.exit_color ?? evidence.side_to_move_at_exit,
                )}`
              : "sortie inconnue"}
          </strong>
        </div>
        <div>
          <span>Après la sortie</span>
          <strong>{openingLinkedMomentLabel(linkedMoment)}</strong>
        </div>
      </div>
      <p className="review-opening-summary">
        {evidence.summary ?? "Diagnostic d'ouverture disponible."}
      </p>
      <div className="review-action-row">
        <button
          type="button"
          onClick={() => onShowOpeningExit(evidence)}
          disabled={!canReviewExit}
        >
          Revoir la sortie
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof linkedMoment?.ply === "number") {
              onShowOpeningLinkedMoment(linkedMoment.ply, evidence);
            }
          }}
          hidden={!canShowLinkedMoment}
          disabled={!canShowLinkedMoment}
        >
          Voir le moment lié
        </button>
      </div>
      {!canShowLinkedMoment && (
        <p className="review-opening-summary">
          Pas de gros problème détecté juste après la sortie.
        </p>
      )}
      <details className="review-opening-intention">
        <summary>Intention d'ouverture</summary>
        <label>
          <span>Note personnelle</span>
          <input
            value={intentionNote}
            onChange={(event) => onIntentionNoteChange(event.target.value)}
            placeholder="Ex. Je voulais jouer la Caro-Kann"
          />
        </label>
        {intentionNote.trim() && (
          <p>
            Intention déclarée : {intentionNote.trim()} · Ouverture détectée :{" "}
            {evidence.opening_name ?? "non classifiée"}
          </p>
        )}
      </details>
    </section>
  );
}


export const ReviewOpeningPanel = OpeningRealityCard;
