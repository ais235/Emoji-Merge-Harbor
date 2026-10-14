/**
 * Уровень предметов «уже видел на поле» и вспомогательные константы для сессии (ящики с генератором).
 */

import type { GridCell, ProgressionState } from "../types";
import { ALL_ITEMS, COBWEB_UNKNOWN_ITEM_ID, itemIsMergeable } from "../types";

/** Максимальный уровень mergeable-предмета на видимых клетках (item / cobweb). */
export function computeMaxSeenMergeableLevelFromGrid(grid: GridCell[]): number {
  let maxL = 1;
  for (const c of grid) {
    if (c.cellType === "item" && c.item) {
      const d = ALL_ITEMS[c.item];
      if (d && itemIsMergeable(d)) maxL = Math.max(maxL, d.level);
    }
    if (c.cellType === "cobweb" && c.item && c.item !== COBWEB_UNKNOWN_ITEM_ID) {
      const lvl = c.itemLevel >= 1 ? c.itemLevel : 1;
      maxL = Math.max(maxL, lvl);
    }
  }
  return maxL;
}

export function bumpMaxSeenItemLevelFromGrid(prog: ProgressionState, grid: GridCell[]): ProgressionState {
  const fromGrid = computeMaxSeenMergeableLevelFromGrid(grid);
  const prev = typeof prog.maxSeenItemLevel === "number" && prog.maxSeenItemLevel >= 1 ? prog.maxSeenItemLevel : 1;
  return { ...prog, maxSeenItemLevel: Math.max(prev, fromGrid) };
}

/**
 * Окно уровней предметов для заказов.
 *
 * Прошлые границы (min 1/2/3, max 2/3/4/5) на уровнях 3–4 и 7–9 схлопывались в **один** уровень:
 * вместе с ограничением «одна цепочка» пул сводился к 1–2 предметам, и три карточки заказов
 * либо просили одно и то же, либо их просто не из чего было собрать.
 * Окно всегда шире одного уровня; сверху его всё равно ограничивает `maxSeenItemLevel + 1`.
 */
export function playerTierMinOrderItemLevel(playerLevel: number): number {
  if (playerLevel < 5) return 1;
  if (playerLevel < 15) return 2;
  return 3;
}

export function playerTierMaxOrderItemLevel(playerLevel: number): number {
  if (playerLevel < 3) return 2;
  if (playerLevel < 6) return 3;
  if (playerLevel < 10) return 4;
  if (playerLevel < 15) return 5;
  return 6;
}

/** Сколько цепочек из активных на поле участвуют в пуле заказов. */
export function playerTierOrderChainSliceCount(playerLevel: number, activeChainCount: number): number {
  if (activeChainCount <= 1) return 1;
  if (playerLevel < 5) return 1;
  if (playerLevel < 10) return Math.min(2, activeChainCount);
  if (playerLevel < 15) return Math.min(3, activeChainCount);
  return activeChainCount;
}
