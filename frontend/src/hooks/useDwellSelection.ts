import { useCallback, useEffect, useRef, useState } from "react";

import { advanceDwell, type FocusableTarget, resolveFocusTarget } from "../lib/selection";
import type { GazePoint } from "../types";

type UseDwellSelectionOptions = {
  gazePoint: GazePoint | null;
  dwellMs: number;
  snapRadius: number;
  onActivate: (targetId: string) => void;
  resolveTargetId?: (gazePoint: GazePoint | null, targets: FocusableTarget[]) => string | null;
};

type ResolveActiveTargetIdOptions = {
  gazePoint: GazePoint | null;
  targets: FocusableTarget[];
  snapRadius: number;
  resolveTargetId?: (gazePoint: GazePoint | null, targets: FocusableTarget[]) => string | null;
};

export function resolveActiveTargetId({
  gazePoint,
  targets,
  snapRadius,
  resolveTargetId,
}: ResolveActiveTargetIdOptions): string | null {
  if (!gazePoint) {
    return null;
  }

  if (resolveTargetId) {
    return resolveTargetId(gazePoint, targets);
  }

  return resolveFocusTarget(targets, gazePoint, snapRadius)?.id ?? null;
}

export function useDwellSelection({
  gazePoint,
  dwellMs,
  snapRadius,
  onActivate,
  resolveTargetId,
}: UseDwellSelectionOptions) {
  const targetsRef = useRef<Map<string, HTMLElement>>(new Map());
  const previousTimestampRef = useRef<number | null>(null);
  const [focusedKeyId, setFocusedKeyId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!gazePoint) {
      setFocusedKeyId(null);
      setProgress(0);
      previousTimestampRef.current = null;
      return;
    }

    const targets: FocusableTarget[] = Array.from(targetsRef.current.entries()).map(([id, element]) => {
      const rect = element.getBoundingClientRect();
      return {
        id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    const nextTargetId = resolveActiveTargetId({
      gazePoint,
      targets,
      snapRadius,
      resolveTargetId,
    });

    setFocusedKeyId((previousTargetId) => {
      const now = performance.now();
      const delta = previousTimestampRef.current === null ? 0 : now - previousTimestampRef.current;
      previousTimestampRef.current = now;

      setProgress((previousProgress) => {
        const nextState = advanceDwell(
          {
            targetId: previousTargetId,
            elapsedMs: previousProgress * dwellMs,
            progress: previousProgress,
            activatedTargetId: null,
          },
          nextTargetId,
          delta,
          dwellMs,
        );
        if (nextState.activatedTargetId) {
          onActivate(nextState.activatedTargetId);
          previousTimestampRef.current = null;
          return 0;
        }
        return nextState.progress;
      });

      return nextTargetId;
    });
  }, [dwellMs, gazePoint, onActivate, resolveTargetId, snapRadius]);

  // Memoizados con dependencias estables (refs/setters) para que su identidad no
  // cambie en cada render. Esto evita que callbacks que dependen de `resetDwell`
  // (p. ej. `startCalibrationPoints`) cambien en cada frame de mirada y reinicien
  // efectos como la cuenta atrás de calibración.
  const registerTarget = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) {
        targetsRef.current.set(id, element);
      } else {
        targetsRef.current.delete(id);
      }
    },
    [],
  );

  const resetDwell = useCallback(() => {
    setFocusedKeyId(null);
    setProgress(0);
    previousTimestampRef.current = null;
  }, []);

  return {
    focusedKeyId,
    dwellProgress: progress,
    registerTarget,
    resetDwell,
  };
}
