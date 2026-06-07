import { useCallback, useState } from "react";

import { DecisionZones } from "./DecisionZones";
import { resolveBinaryDecisionTarget } from "../lib/decisionZone";
import { useDwellSelection } from "../hooks/useDwellSelection";
import type { FocusableTarget } from "../lib/selection";
import type { GazePoint } from "../types";

export type CustomQuestionPhase = "idle" | "compose" | "asking";

type CustomQuestionOverlayProps = {
  phase: Exclude<CustomQuestionPhase, "idle">;
  /** Texto de la pregunta (se usa como cabecera en la fase de respuesta). */
  question: string;
  gazePoint: GazePoint | null;
  dwellMs: number;
  snapRadius: number;
  neutralZonePercent: number;
  yesLabel: string;
  noLabel: string;
  /** Generando el audio de la pregunta (voz de backend) antes de mostrarla. */
  loading?: boolean;
  onShow: (text: string) => void;
  onAnswer: (answer: "Sí" | "No") => void;
  onCancel: () => void;
};

export function CustomQuestionOverlay({
  phase,
  question,
  gazePoint,
  dwellMs,
  snapRadius,
  neutralZonePercent,
  yesLabel,
  noLabel,
  loading = false,
  onShow,
  onAnswer,
  onCancel,
}: CustomQuestionOverlayProps) {
  const [draft, setDraft] = useState("");

  const handleActivate = useCallback(
    (targetId: string) => {
      if (targetId === "decision-yes") {
        onAnswer("Sí");
      } else if (targetId === "decision-no") {
        onAnswer("No");
      }
    },
    [onAnswer],
  );

  const resolveTargetId = useCallback(
    (point: GazePoint | null, targets: FocusableTarget[]) =>
      resolveBinaryDecisionTarget(point, targets, neutralZonePercent),
    [neutralZonePercent],
  );

  const { focusedKeyId, dwellProgress, registerTarget } = useDwellSelection({
    gazePoint: phase === "asking" ? gazePoint : null,
    dwellMs,
    snapRadius,
    onActivate: handleActivate,
    resolveTargetId,
  });

  if (phase === "compose") {
    const trimmed = draft.trim();
    return (
      <div className="custom-question-overlay" role="dialog" aria-modal="true" aria-label="Crear pregunta personalizada">
        <div className="custom-question-compose">
          <header className="custom-question-compose__header">
            <p className="eyebrow">Pregunta auxiliar</p>
            <h2>Escribe una pregunta personalizada</h2>
            <p>
              Se mostrará a la persona para que responda Sí/No con la mirada. Se guarda
              aparte del formulario y nunca se envía al proveedor externo.
            </p>
          </header>
          <textarea
            className="custom-question-compose__input"
            aria-label="Texto de la pregunta personalizada"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Ej.: ¿Estás cómodo con la postura?"
            autoFocus
          />
          <div className="custom-question-compose__actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={trimmed.length === 0 || loading}
              onClick={() => onShow(trimmed)}
            >
              {loading ? "Generando voz..." : "Mostrar al usuario"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="eye-rest-overlay eye-rest-overlay--prompt" role="dialog" aria-modal="true" aria-label="Pregunta personalizada">
      <div className="eye-rest-prompt">
        <DecisionZones
          header={
            <header className="eye-rest-prompt__header">
              <p className="eyebrow">Pregunta auxiliar</p>
              <h2>{question}</h2>
              <p>Mira a un lado para responder.</p>
            </header>
          }
          restTitle="Pregunta"
          restHint="Mira al lado para responder."
          yesLabel={yesLabel}
          yesHint="Mirada a la derecha"
          noLabel={noLabel}
          noHint="Mirada a la izquierda"
          focusedTargetId={focusedKeyId}
          dwellProgress={dwellProgress}
          neutralZonePercent={neutralZonePercent}
          registerTarget={registerTarget}
          onAnswerYes={() => onAnswer("Sí")}
          onAnswerNo={() => onAnswer("No")}
        />
        <button type="button" className="text-button custom-question-cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
