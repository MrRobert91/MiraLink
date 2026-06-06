import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AppNavigation } from "./AppNavigation";

describe("AppNavigation", () => {
  it("links to the three public MiraLink routes", () => {
    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "MiraLink" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Administración" })).toHaveAttribute(
      "href",
      "/administracion",
    );
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "href",
      "/configuracion",
    );
  });
});
