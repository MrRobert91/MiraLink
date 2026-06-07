type AnsweringToolbarProps = {
  currentStep: number;
  totalSteps: number;
  trackingReady: boolean;
  onExit: () => void;
  onOpenSettings: () => void;
  onCustomQuestion: () => void;
};

export function AnsweringToolbar({
  currentStep,
  totalSteps,
  trackingReady,
  onExit,
  onOpenSettings,
  onCustomQuestion,
}: AnsweringToolbarProps) {
  return (
    <header className="answering-toolbar">
      <button type="button" className="text-button" onClick={onExit}>
        Salir
      </button>
      <strong>
        Paso {currentStep} de {totalSteps}
      </strong>
      {!trackingReady ? (
        <span className="tracking-status">Inicializando mirada</span>
      ) : null}
      <button
        type="button"
        className="secondary-button answering-custom-question-button"
        onClick={onCustomQuestion}
      >
        Pregunta personalizada
      </button>
      <button type="button" className="secondary-button answering-settings-button" onClick={onOpenSettings}>
        Configuración
      </button>
    </header>
  );
}
