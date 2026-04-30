import type { Evaluation } from "./api/client";

const LICHESS_EVAL_FACTOR = 0.00368208;

export function makeEvaluationDisplayFromEngineScore(
  evalCp: number | null | undefined,
  mateIn: number | null | undefined,
): Evaluation | null {
  if (typeof mateIn === "number") {
    if (mateIn > 0) {
      return {
        white_percent: 100.0,
        black_percent: 0.0,
        label: `M${Math.abs(mateIn)}`,
        is_mate: true,
        advantage_side: "white",
        magnitude: "mate",
      };
    }
    if (mateIn < 0) {
      return {
        white_percent: 0.0,
        black_percent: 100.0,
        label: `-M${Math.abs(mateIn)}`,
        is_mate: true,
        advantage_side: "black",
        magnitude: "mate",
      };
    }
  }

  if (typeof evalCp !== "number") {
    return null;
  }

  const rawWhite = 100 / (1 + Math.exp(-LICHESS_EVAL_FACTOR * evalCp));
  const whitePercent = clamp(round1(rawWhite), 0.0, 100.0);
  const blackPercent = round1(100.0 - whitePercent);
  const pawns = evalCp / 100;

  return {
    white_percent: whitePercent,
    black_percent: blackPercent,
    label: pawns === 0 ? "0.00" : pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2),
    is_mate: false,
    advantage_side: evalCp > 0 ? "white" : evalCp < 0 ? "black" : "equal",
    magnitude: magnitudeForCp(evalCp),
  };
}

function magnitudeForCp(evalCp: number): string {
  const absolute = Math.abs(evalCp);
  if (absolute >= 500) {
    return "decisive";
  }
  if (absolute >= 200) {
    return "large";
  }
  if (absolute >= 80) {
    return "clear";
  }
  if (absolute > 0) {
    return "small";
  }
  return "equal";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
