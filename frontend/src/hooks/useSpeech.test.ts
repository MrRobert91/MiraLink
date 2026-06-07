import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpeech } from "./useSpeech";

class UtteranceMock {
  text: string;
  voice: unknown = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class AudioMock {
  src: string;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) {
    this.src = src;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSpeech", () => {
  it("usa SpeechSynthesis para voces de navegador y refleja isSpeaking", () => {
    const speak = vi.fn((utterance: UtteranceMock) => utterance.onstart?.());
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", UtteranceMock);
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [{ name: "Helena", lang: "es-ES" }],
      speak,
      cancel,
    });

    const { result } = renderHook(() => useSpeech({ voiceId: "", rate: 1.2 }));

    act(() => result.current.speak("Hola"));
    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0][0].rate).toBe(1.2);
    expect(result.current.isSpeaking).toBe(true);

    act(() => result.current.cancel());
    expect(cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it("reproduce audio de backend cuando hay URL preparada y bloquea isSpeaking", () => {
    vi.stubGlobal("Audio", AudioMock);
    vi.stubGlobal("speechSynthesis", { getVoices: () => [], speak: vi.fn(), cancel: vi.fn() });
    const getAudioUrl = vi.fn(() => "http://api/tts/audio?x=1");

    const { result } = renderHook(() =>
      useSpeech({ voiceId: "piper:es_ES-davefx-medium", rate: 1, getAudioUrl }),
    );

    act(() => result.current.speak("¿Tienes dolor?. Sí"));
    expect(getAudioUrl).toHaveBeenCalledWith("¿Tienes dolor?. Sí");
    expect(result.current.isSpeaking).toBe(true);
  });

  it("ignora textos vacíos", () => {
    const speak = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", UtteranceMock);
    vi.stubGlobal("speechSynthesis", { getVoices: () => [], speak, cancel: vi.fn() });

    const { result } = renderHook(() => useSpeech({ voiceId: "", rate: 1 }));
    act(() => result.current.speak("   "));
    expect(speak).not.toHaveBeenCalled();
  });
});
