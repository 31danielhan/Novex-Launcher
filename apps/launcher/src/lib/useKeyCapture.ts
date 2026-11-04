import { useEffect, useState } from "react";
import { keyFromEvent, keyFromMouse } from "./gameOptions";

/**
 * Waits for the next key or mouse button once a bind id is set, then reports it. Esc unbinds.
 * Returns the id being waited on and its setter.
 */
export function useKeyCapture(onKey: (id: string, key: string) => void) {
  const [waiting, setWaiting] = useState<string | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const finish = (key: string | null) => {
      setWaiting(null);
      if (key) onKey(waiting, key);
    };
    const key = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finish(e.code === "Escape" ? "key.keyboard.unknown" : keyFromEvent(e));
    };
    const mouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finish(keyFromMouse(e.button));
    };
    const noMenu = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", key, true);
    // Wait a frame so the click that started listening isn't taken as the new binding.
    const timer = setTimeout(() => window.addEventListener("mousedown", mouse, true), 0);
    window.addEventListener("contextmenu", noMenu, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("mousedown", mouse, true);
      window.removeEventListener("contextmenu", noMenu, true);
    };
  }, [waiting]);

  return [waiting, setWaiting] as const;
}
