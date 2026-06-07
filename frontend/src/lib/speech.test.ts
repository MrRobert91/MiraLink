import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserVoiceId,
  findBrowserVoice,
  isSpeechSynthesisSupported,
  listBrowserVoices,
  voiceEngine,
} from "./speech";

function stubVoices(voices: Array<{ name: string; lang: string }>) {
  vi.stubGlobal("speechSynthesis", { getVoices: () => voices });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("speech helpers", () => {
  it("voiceEngine extrae el motor del id cualificado", () => {
    expect(voiceEngine("piper:es_ES-davefx-medium")).toBe("piper");
    expect(voiceEngine("browser:Helena")).toBe("browser");
  });

  it("browserVoiceId prefija con el motor del navegador", () => {
    expect(browserVoiceId("Helena")).toBe("browser:Helena");
  });

  it("isSpeechSynthesisSupported refleja la presencia de la API", () => {
    stubVoices([]);
    expect(isSpeechSynthesisSupported()).toBe(true);
  });

  it("listBrowserVoices mapea y ordena el español primero", () => {
    stubVoices([
      { name: "Zira", lang: "en-US" },
      { name: "Helena", lang: "es-ES" },
    ]);
    const voices = listBrowserVoices();
    expect(voices[0]).toMatchObject({ id: "browser:Helena", engine: "browser", lang: "es-ES" });
    expect(voices[1].lang).toBe("en-US");
  });

  it("findBrowserVoice resuelve por id y, en automático, elige español", () => {
    stubVoices([
      { name: "Zira", lang: "en-US" },
      { name: "Helena", lang: "es-ES" },
    ]);
    expect(findBrowserVoice("browser:Zira")?.name).toBe("Zira");
    expect(findBrowserVoice("")?.name).toBe("Helena");
  });
});
