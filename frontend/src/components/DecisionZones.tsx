import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefCallback } from "react";

import { buildDecisionGridColumns, REST_TARGET_ID } from "../lib/decisionZone";

type DecisionZonesProps = {
  /** Cabecera (pregunta) que se muestra sobre la rejilla de decisión. */
  header: ReactNode;
  restTitle: string;
  restHint: string;
  yesLabel: string;
  yesHint: string;
  noLabel: string;
  noHint: string;
  focusedTargetId: string | null;
  dwellProgress: number;
  /**
   * Progreso (0–1) del dwell sobre la zona de descanso. La barra solo aparece
   * pasada la mitad del tiempo y se llena desde cero durante la segunda mitad.
   */
  restDwellProgress?: number;
  neutralZonePercent: number;
  registerTarget: (id: string) => RefCallback<HTMLElement>;
  onAnswerYes: () => void;
  onAnswerNo: () => void;
};

export function DecisionZones({
  header,
  restTitle,
  restHint,
  yesLabel,
  yesHint,
  noLabel,
  noHint,
  focusedTargetId,
  dwellProgress,
  restDwellProgress = 0,
  neutralZonePercent,
  registerTarget,
  onAnswerYes,
  onAnswerNo,
}: DecisionZonesProps) {
  const restElementRef = useRef<HTMLDivElement | null>(null);
  const registerRestRef = registerTarget(REST_TARGET_ID);
  const [restBand, setRestBand] = useState<{ left: number; right: number } | null>(null);

  const setRestNode = useCallback(
    (node: HTMLDivElement | null) => {
      restElementRef.current = node;
      registerRestRef(node);
    },
    [registerRestRef],
  );

  useLayoutEffect(() => {
    const node = restElementRef.current;
    if (!node) {
      setRestBand(null);
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setRestBand((previous) => {
        if (previous && previous.left === rect.left && previous.right === rect.right) {
          return previous;
        }
        return { left: rect.left, right: rect.right };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [neutralZonePercent]);

  const noFocused = focusedTargetId === "decision-no";
  const yesFocused = focusedTargetId === "decision-yes";
  const [leftWidth, centerWidth, rightWidth] = buildDecisionGridColumns(neutralZonePercent);
  const gridStyle: CSSProperties = { gridTemplateColumns: `${leftWidth} ${centerWidth} ${rightWidth}` };
  const overlayStyle: CSSProperties | undefined = restBand
    ? ({
        "--rest-left": `${restBand.left}px`,
        "--rest-right": `${restBand.right}px`,
      } as CSSProperties)
    : undefined;

  // La barra de descanso aparece solo pasada la mitad del tiempo y se llena
  // desde cero durante la segunda mitad (coherente con los dwell de Sí/No).
  const restBarProgress = restDwellProgress >= 0.5 ? (restDwellProgress - 0.5) * 2 : 0;

  return (
    <>
      {overlayStyle ? (
        <div className="decision-side-overlays" style={overlayStyle} aria-hidden="true">
          <span className={`decision-side-overlay decision-side-overlay--no${noFocused ? " decision-side-overlay--active" : ""}`} />
          <span className={`decision-side-overlay decision-side-overlay--yes${yesFocused ? " decision-side-overlay--active" : ""}`} />
        </div>
      ) : null}

      {header}

      <div className="binary-decision-grid" style={gridStyle}>
        <button
          ref={registerTarget("decision-no")}
          type="button"
          className={`decision-zone decision-zone--no${noFocused ? " decision-zone--focused" : ""}`}
          onClick={onAnswerNo}
        >
          <span>{noLabel}</span>
          <small>{noHint}</small>
          {noFocused ? <span className="decision-zone__progress" style={{ transform: `scaleX(${dwellProgress})` }} /> : null}
        </button>

        <div ref={setRestNode} className="decision-rest-zone" aria-label="Zona de descanso visual">
          <strong>{restTitle}</strong>
          <span>{restHint}</span>
          {restBarProgress > 0 ? (
            <span
              className="decision-rest-zone__progress"
              style={{ transform: `scaleX(${restBarProgress})` }}
              aria-hidden="true"
            />
          ) : null}
        </div>

        <button
          ref={registerTarget("decision-yes")}
          type="button"
          className={`decision-zone decision-zone--yes${yesFocused ? " decision-zone--focused" : ""}`}
          onClick={onAnswerYes}
        >
          <span>{yesLabel}</span>
          <small>{yesHint}</small>
          {yesFocused ? <span className="decision-zone__progress" style={{ transform: `scaleX(${dwellProgress})` }} /> : null}
        </button>
      </div>
    </>
  );
}
