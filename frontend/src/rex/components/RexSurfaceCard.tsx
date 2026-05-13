import type { RexPreviewCard } from "../rexTypes";

type RexSurfaceCardProps = {
  card: RexPreviewCard;
};

export function RexSurfaceCard({ card }: RexSurfaceCardProps) {
  return (
    <article className="rex-surface-card">
      <div className="rex-surface-card__status">{card.status}</div>
      <h3>{card.title}</h3>
      <p>{card.body}</p>
    </article>
  );
}
