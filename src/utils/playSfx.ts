/**
 * SFX: сначала `public/sounds/<name>.mp3`, при ошибке загрузки/воспроизведения — синтез из `sounds.ts` (как раньше).
 * Управление mute — общее с `sounds.ts`.
 */

import { isSoundMuted, sounds } from "./sounds";

function playSynthFallback(srcName: string): void {
  if (isSoundMuted()) return;
  switch (srcName) {
    case "merge_pop":
      sounds.merge();
      break;
    case "order_complete":
      sounds.orderComplete();
      break;
    case "generator_tap":
    case "box_open":
      sounds.select();
      break;
    case "coin_land":
      sounds.select();
      break;
    case "coin_fly":
      break;
    default:
      sounds.select();
  }
}

export function playSfx(srcName: string, volume = 0.5): void {
  if (isSoundMuted() || typeof window === "undefined") return;
  let usedFallback = false;
  const runFallback = () => {
    if (usedFallback) return;
    usedFallback = true;
    playSynthFallback(srcName);
  };

  try {
    const url = `${import.meta.env.BASE_URL}sounds/${srcName}.mp3`;
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    a.addEventListener("error", runFallback, { once: true });
    const p = a.play();
    if (p && typeof p.catch === "function") {
      void p.catch(runFallback);
    }
  } catch {
    runFallback();
  }
}
