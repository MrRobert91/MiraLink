import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpeech } from "./useSpeech";

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
  it("reproduce audio de backend cuando hay URL preparada y bloquea isSpeaking", () => {
    vi.stubGlobal("Audio", AudioMock);
    const getAudioUrl = vi.fn(() => "http://api/tts/audio?x=1");

    const { result } = renderHook(() => useSpeech({ rate: 1, getAudioUrl }));

    act(() => result.current.speak("¿Tienes dolor?. Sí"));
    expect(getAudioUrl).toHaveBeenCalledWith("¿Tienes dolor?. Sí");
    expect(result.current.isSpeaking).toBe(true);

    act(() => result.current.cancel());
    expect(result.current.isSpeaking).toBe(false);
  });

  it("sin URL preparada no lee y dispara onEnd (silencio)", () => {
    vi.stubGlobal("Audio", AudioMock);
    const onEnd = vi.fn();
    const getAudioUrl = vi.fn(() => null);

    const { result } = renderHook(() => useSpeech({ rate: 1, getAudioUrl, onEnd }));

    act(() => result.current.speak("Sin audio"));
    expect(onEnd).toHaveBeenCalledOnce();
    expect(result.current.isSpeaking).toBe(false);
  });

  it("ignora textos vacíos", () => {
    vi.stubGlobal("Audio", AudioMock);
    const onEnd = vi.fn();

    const { result } = renderHook(() => useSpeech({ rate: 1, onEnd }));
    act(() => result.current.speak("   "));
    expect(onEnd).not.toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});
