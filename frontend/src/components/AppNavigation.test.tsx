import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

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
  it("returns to the initial home state when the MiraLink logo is clicked", () => {
    const onHome = vi.fn();

    render(
      <MemoryRouter>
        <AppNavigation onHome={onHome} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "MiraLink" }));

    expect(onHome).toHaveBeenCalledOnce();
  });
});
