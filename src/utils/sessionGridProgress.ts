/**
 * Уровень предметов «уже видел на поле» и вспомогательные константы для сессии (ящики с генератором).
 */

import type { ActiveZone, GridCell, ProgressionState } from "../types";
import {
  ALL_ACTIVE_ZONES,
  ALL_ITEMS,
  COBWEB_UNKNOWN_ITEM_ID,
  generatorItemIdForZone,
  itemIsGenerator,
  itemIsResourcePickup,
} from "../types";

/** Порядок разблокировки комнат в хабе — следующие генераторы в ящиках только после текущей зоны. */
const ZONE_UNLOCK_ORDER: ActiveZone[] = [
  "hall",
  "kitchen",
  "bedroom",
  "bathroom",
  "garden",
  "terrace",
  "office",
  "lounge",
  "secret",
];

/** Id генераторов следующих комнат (по прогрессии хаба). */
export function hiddenSessionGeneratorIdsForZone(zone: ActiveZone): string[] {
  const primary = generatorItemIdForZone(zone);
  const idx = ZONE_UNLOCK_ORDER.indexOf(zone);
  if (idx < 0) {
    return ALL_ACTIVE_ZONES.filter((z) => z !== zone)
      .map((z) => generatorItemIdForZone(z))
      .filter((id) => id !== primary);
  }
  return ZONE_UNLOCK_ORDER.slice(idx + 1).map((z) => generatorItemIdForZone(z));
}

/** Максимальный уровень mergeable-предмета на видимых клетках (item / cobweb). */
export function computeMaxSeenMergeableLevelFromGrid(grid: GridCell[]): number {
  let maxL = 1;
  for (const c of grid) {
    if (c.cellType === "item" && c.item) {
      const d = ALL_ITEMS[c.item];
      if (d && "level" in d && !itemIsGenerator(d) && !itemIsResourcePickup(d)) {
        maxL = Math.max(maxL, d.level);
      }
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

/** Верхняя граница уровня предмета в заказе по уровню игрока (таблица дизайна). */
export function playerTierMaxOrderItemLevel(playerLevel: number): number {
  if (playerLevel < 5) return 1;
  if (playerLevel < 10) return 2;
  if (playerLevel < 20) return 3;
  return 7;
}

/** Сколько позиций в заказе по уровню игрока. */
export function playerTierOrderSlotCount(playerLevel: number): number {
  if (playerLevel < 10) return 1;
  if (playerLevel < 15) return 1 + Math.floor(Math.random() * 2);
  if (playerLevel < 20) return 2;
  return 2 + Math.floor(Math.random() * 2);
}

/** Сколько цепочек из активных на поле участвуют в пуле заказов. */
export function playerTierOrderChainSliceCount(playerLevel: number, activeChainCount: number): number {
  if (activeChainCount <= 1) return 1;
  if (playerLevel < 10) return 1;
  if (playerLevel < 20) return Math.min(2, activeChainCount);
  return activeChainCount;
}
