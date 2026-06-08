import { describe, expect, it } from "vitest";

import { DEFAULT_VOICE_ID, resolveVoiceId, voiceEngine } from "./speech";

describe("speech helpers", () => {
  it("voiceEngine extrae el motor del id cualificado", () => {
    expect(voiceEngine("piper:es_ES-davefx-medium")).toBe("piper");
    expect(voiceEngine("kokoro:es_ES")).toBe("kokoro");
  });

  it("resolveVoiceId usa la voz por defecto cuando está vacío", () => {
    expect(resolveVoiceId("")).toBe(DEFAULT_VOICE_ID);
    expect(resolveVoiceId("piper:otra-voz")).toBe("piper:otra-voz");
  });
});
