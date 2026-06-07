import "@testing-library/jest-dom/vitest";

// jsdom no implementa ResizeObserver, usado por DecisionZones y derivados.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}
