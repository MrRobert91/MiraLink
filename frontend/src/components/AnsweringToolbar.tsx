type AnsweringToolbarProps = {
  currentStep: number;
  totalSteps: number;
  trackingReady: boolean;
  onExit: () => void;
  onOpenSettings: () => void;
};

export function AnsweringToolbar({
  currentStep,
  totalSteps,
  trackingReady,
  onExit,
  onOpenSettings,
}: AnsweringToolbarProps) {
  return (
    <header className="answering-toolbar">
      <button type="button" className="text-button" onClick={onExit}>
        Salir
      </button>
      <strong>
        Paso {currentStep} de {totalSteps}
      </strong>
      <span className={trackingReady ? "tracking-status tracking-status--ready" : "tracking-status"}>
        {trackingReady ? "Seguimiento listo" : "Inicializando mirada"}
      </span>
      <button type="button" className="secondary-button answering-settings-button" onClick={onOpenSettings}>
        Configuración
      </button>
    </header>
  );
}
