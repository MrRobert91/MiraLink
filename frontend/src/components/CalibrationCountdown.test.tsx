import { render, screen } from "@testing-library/react";

import { CalibrationCountdown } from "./CalibrationCountdown";

describe("CalibrationCountdown", () => {
  it("muestra el número de la cuenta atrás", () => {
    render(<CalibrationCountdown value={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Preparándose")).toBeInTheDocument();
  });

  it("renderiza el fondo de cámara cuando se proporciona", () => {
    render(
      <CalibrationCountdown value={1} cameraBackdrop={<div data-testid="backdrop" />} />,
    );
    expect(screen.getByTestId("backdrop")).toBeInTheDocument();
  });
});
