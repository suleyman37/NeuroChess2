import { TodayHeroVisualConstellation } from "./TodayHeroVisualConstellation";
import { TodayHeroVisualPoster } from "./TodayHeroVisualPoster";
import { useInViewport } from "./useInViewport";
import { useReducedMotion } from "./useReducedMotion";

export function TodayHeroVisual() {
  const reducedMotion = useReducedMotion();
  const { ref, isInViewport } = useInViewport<HTMLDivElement>({ rootMargin: "240px" });
  const liveMotion = isInViewport ? "full" : "paused";
  const motion = reducedMotion ? "reduced" : liveMotion;
  const renderer = reducedMotion ? "poster" : "svg";

  return (
    <div
      ref={ref}
      className="v2-hero-visual"
      aria-hidden="true"
      data-testid="v2-hero-visual"
      data-hero-visual-theme="decision-constellation"
      data-renderer={renderer}
      data-motion={motion}
    >
      {reducedMotion ? <TodayHeroVisualPoster /> : <TodayHeroVisualConstellation motion={liveMotion} />}
    </div>
  );
}
