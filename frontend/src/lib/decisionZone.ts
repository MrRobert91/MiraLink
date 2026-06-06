import type { FocusableTarget } from "./selection";
import type { GazePoint } from "../types";

export const REST_TARGET_ID = "decision-rest";

/**
 * Horizontal limits of the central rest band, in viewport pixels.
 * Anything to the left of `left` selects "No"; anything to the right of
 * `right` selects "Yes"; the band in between is neutral.
 */
export type RestBand = {
  left: number;
  right: number;
};

/**
 * Derives the rest band from the rendered rest-zone element when available,
 * falling back to a band centred on the viewport sized by `restPercent`.
 */
export function resolveRestBand(
  targets: readonly FocusableTarget[],
  restPercent: number,
  viewportWidth: number,
): RestBand {
  const rest = targets.find((target) => target.id === REST_TARGET_ID);
  if (rest && rest.width > 0) {
    return { left: rest.x, right: rest.x + rest.width };
  }

  const boundedRest = Math.min(Math.max(restPercent, 10), 40);
  const sideWidth = (viewportWidth * (100 - boundedRest)) / 200;
  return { left: sideWidth, right: viewportWidth - sideWidth };
}

/**
 * Resolves the decision target using full-height vertical bands instead of the
 * visible boxes: the whole left side of the screen counts as "No" and the whole
 * right side as "Yes", while the central rest band cancels any selection.
 * Vertical position is ignored, so drifting above or below a box keeps the dwell.
 */
export function resolveBinaryDecisionTarget(
  gazePoint: GazePoint | null,
  targets: readonly FocusableTarget[],
  restPercent = 24,
  viewportWidth: number = typeof window !== "undefined" ? window.innerWidth : 0,
): "decision-no" | "decision-yes" | null {
  if (!gazePoint) {
    return null;
  }

  const band = resolveRestBand(targets, restPercent, viewportWidth);

  if (gazePoint.x < band.left) {
    return "decision-no";
  }
  if (gazePoint.x > band.right) {
    return "decision-yes";
  }

  return null;
}

export function buildDecisionGridColumns(restPercent: number): [string, string, string] {
  const boundedRest = Math.min(Math.max(restPercent, 10), 40);
  const sidePercent = (100 - boundedRest) / 2;
  return [`${sidePercent}%`, `${boundedRest}%`, `${sidePercent}%`];
}
