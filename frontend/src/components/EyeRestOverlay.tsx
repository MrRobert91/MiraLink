import { useCallback, useEffect, useState } from "react";

import { DecisionZones } from "./DecisionZones";
import { resolveBinaryDecisionTarget } from "../lib/decisionZone";
import { useDwellSelection } from "../hooks/useDwellSelection";
import type { FocusableTarget } from "../lib/selection";
import type { GazePoint } from "../types";

export type EyeRestPhase = "idle" | "prompt" | "resting";

type EyeRestOverlayProps = {
  phase: Exclude<EyeRestPhase, "idle">;
  /** Punto de mirada accionable; solo se usa en la fase de pregunta. */
  gazePoint: GazePoint | null;
  dwellMs: number;
  snapRadius: number;
  neutralZonePercent: number;
  pauseSeconds: number;
  /** true cuando se re-pregunta tras una pausa ya disfrutada. */
  followUp: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onPauseComplete: () => void;
};

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EyeRestOverlay({
  phase,
  gazePoint,
  dwellMs,
  snapRadius,
  neutralZonePercent,
  pauseSeconds,
  followUp,
  onAccept,
  onDecline,
  onPauseComplete,
}: EyeRestOverlayProps) {
  const handlePromptActivate = useCallback(
    (targetId: string) => {
      if (targetId === "decision-yes") {
        onAccept();
      } else if (targetId === "decision-no") {
        onDecline();
      }
    },
    [onAccept, onDecline],
  );

  const resolvePromptTargetId = useCallback(
    (point: GazePoint | null, targets: FocusableTarget[]) =>
      resolveBinaryDecisionTarget(point, targets, neutralZonePercent),
    [neutralZonePercent],
  );

  const { focusedKeyId, dwellProgress, registerTarget } = useDwellSelection({
    gazePoint: phase === "prompt" ? gazePoint : null,
    dwellMs,
    snapRadius,
    onActivate: handlePromptActivate,
    resolveTargetId: resolvePromptTargetId,
  });

  const [secondsLeft, setSecondsLeft] = useState(pauseSeconds);

  useEffect(() => {
    if (phase !== "resting") {
      return;
    }

    setSecondsLeft(pauseSeconds);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(pauseSeconds - elapsed, 0);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        onPauseComplete();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [phase, pauseSeconds, onPauseComplete]);

  if (phase === "resting") {
    return (
      <div className="eye-rest-overlay eye-rest-overlay--resting" role="status" aria-live="polite">
        <div className="eye-rest-resting">
          <p className="eye-rest-resting__label">Descansa la vista</p>
          <p className="eye-rest-resting__countdown">{formatCountdown(secondsLeft)}</p>
          <p className="eye-rest-resting__hint">
            Relaja la mirada. Volveremos al formulario cuando termine la cuenta atrás.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="eye-rest-overlay eye-rest-overlay--prompt" role="dialog" aria-modal="true" aria-label="Pausa de descanso">
      <div className="eye-rest-prompt">
        <DecisionZones
          header={
            <header className="eye-rest-prompt__header">
              <p className="eyebrow">Descanso de la vista</p>
              <h2>{followUp ? "¿Quieres otra pausa de 1 minuto?" : "¿Quieres hacer una pausa de 1 minuto?"}</h2>
              <p>Tus respuestas se conservan. Mira a un lado para elegir.</p>
            </header>
          }
          restTitle="Pausa"
          restHint="Mira al lado para decidir."
          yesLabel="Sí"
          yesHint="Descansar un minuto"
          noLabel="No"
          noHint="Seguir respondiendo"
          focusedTargetId={focusedKeyId}
          dwellProgress={dwellProgress}
          neutralZonePercent={neutralZonePercent}
          registerTarget={registerTarget}
          onAnswerYes={onAccept}
          onAnswerNo={onDecline}
        />
      </div>
    </div>
  );
}
