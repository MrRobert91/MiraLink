type AnsweringToolbarProps = {
  currentStep: number;
  totalSteps: number;
  trackingReady: boolean;
  onExit: () => void;
  onPause: () => void;
  onOpenSettings: () => void;
  onCustomQuestion: () => void;
};

export function AnsweringToolbar({
  currentStep,
  totalSteps,
  trackingReady,
  onExit,
  onPause,
  onOpenSettings,
  onCustomQuestion,
}: AnsweringToolbarProps) {
  return (
    <header className="answering-toolbar">
      <div className="answering-toolbar__left">
        <button type="button" className="text-button" onClick={onExit}>
          Salir
        </button>
      </div>
      <strong className="answering-toolbar__step">
        Paso {currentStep} de {totalSteps}
      </strong>
      <div className="answering-toolbar__right">
        {!trackingReady ? (
          <span className="tracking-status">Inicializando mirada</span>
        ) : null}
        <button type="button" className="secondary-button answering-pause-button" onClick={onPause}>
          Pausa
        </button>
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
      </div>
    </header>
  );
}
