/**
 * SFX: если в `public/sounds/<name>.mp3` лежит файл — играем его, иначе синтез из `sounds.ts`.
 *
 * Раньше на каждый звук безусловно создавался `new Audio(url)`; папка `public/sounds` пустая,
 * поэтому каждый мердж/заказ давал 404 и ошибку в консоли. Теперь недостающее имя
 * запоминается после первой неудачи и больше не запрашивается.
 */

import { isSoundMuted, sounds } from "./sounds";

const missingSfx = new Set<string>();

function playSynthFallback(srcName: string): void {
  if (isSoundMuted()) return;
  switch (srcName) {
    case "merge_pop":
      sounds.merge();
      break;
    case "order_complete":
      sounds.orderComplete();
      break;
    case "coin_fly":
      break;
    case "generator_tap":
    case "box_open":
    case "coin_land":
    default:
      sounds.select();
  }
}

export function playSfx(srcName: string, volume = 0.5): void {
  if (isSoundMuted() || typeof window === "undefined") return;

  if (missingSfx.has(srcName)) {
    playSynthFallback(srcName);
    return;
  }

  let usedFallback = false;
  const runFallback = () => {
    if (usedFallback) return;
    usedFallback = true;
    missingSfx.add(srcName);
    playSynthFallback(srcName);
  };

  try {
    const a = new Audio(`${import.meta.env.BASE_URL}sounds/${srcName}.mp3`);
    a.volume = Math.max(0, Math.min(1, volume));
    a.addEventListener("error", runFallback, { once: true });
    const p = a.play();
    if (p && typeof p.catch === "function") void p.catch(runFallback);
  } catch {
    runFallback();
  }
}
