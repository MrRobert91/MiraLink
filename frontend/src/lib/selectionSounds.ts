export type SelectionSound = {
  /** Identificador persistido en las preferencias. */
  id: string;
  label: string;
  /** Ruta servida desde /public. */
  src: string;
};

/**
 * Catálogo de sonidos cortos incluidos para el feedback de selección. Los
 * archivos viven en `public/sounds/` y se referencian por ruta absoluta.
 */
export const selectionSounds: SelectionSound[] = [
  { id: "chime-up", label: "Campanita ascendente", src: "/sounds/chime-up.wav" },
  { id: "chime-down", label: "Campanita descendente", src: "/sounds/chime-down.wav" },
  { id: "ding", label: "Ding", src: "/sounds/ding.wav" },
  { id: "soft-beep", label: "Pitido suave", src: "/sounds/soft-beep.wav" },
  { id: "click", label: "Clic", src: "/sounds/click.wav" },
  { id: "pop", label: "Pop", src: "/sounds/pop.wav" },
  { id: "buzz", label: "Zumbido grave", src: "/sounds/buzz.wav" },
];

export function getSelectionSoundSrc(id: string): string | null {
  return selectionSounds.find((sound) => sound.id === id)?.src ?? null;
}
