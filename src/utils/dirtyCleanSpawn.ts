import type { GridCell } from "../types";
import {
  COIN_PICKUP_ITEM_ID,
  ENERGY_PICKUP_ITEM_ID,
  DIRTY_LOOT_RESOURCE_CHANCE,
  chainsEligibleForLootAndOrders,
} from "../types";
import { getNeighborIndices } from "./grid";

/** Базовый шанс выпадения лута при очистке грязи dirty_1 → normal (к апгрейду dirty_drop_chance). */
export const DIRTY_CLEAN_DROP_CHANCE = 0.5;

function pickLootTargetCell(
  grid: GridCell[],
  clearedIndex: number,
  width: number,
  height: number
): number | null {
  const self = grid[clearedIndex];
  if (self.cellState === "normal" && self.item === null) {
    return clearedIndex;
  }
  const neighbors = getNeighborIndices(clearedIndex, width, height);
  const empties = neighbors.filter(
    (i) => grid[i].cellState === "normal" && grid[i].item === null
  );
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)];
}

/**
 * После перехода клетки в normal с dirty_1 — с шансом кладёт награду (предмет цепочки или ресурс).
 * Мутирует `grid`. Возвращает индекс клетки, куда положили предмет, или null.
 */
export function trySpawnLootOnDirtyOneClear(
  grid: GridCell[],
  clearedIndex: number,
  width: number,
  height: number,
  cleanDropBonus = 0
): number | null {
  const p = Math.min(1, DIRTY_CLEAN_DROP_CHANCE + Math.max(0, cleanDropBonus));
  if (Math.random() >= p) return null;

  const target = pickLootTargetCell(grid, clearedIndex, width, height);
  if (target === null) return null;

  let itemId: string;
  if (Math.random() < DIRTY_LOOT_RESOURCE_CHANCE) {
    itemId = Math.random() < 0.5 ? COIN_PICKUP_ITEM_ID : ENERGY_PICKUP_ITEM_ID;
  } else {
    const chainList = chainsEligibleForLootAndOrders();
    if (chainList.length === 0) return null;
    const chain = chainList[Math.floor(Math.random() * chainList.length)];
    const first = chain.items[0];
    if (!first) return null;
    itemId = first.id;
  }

  grid[target] = { ...grid[target], item: itemId, generatorCharges: undefined };
  return target;
}
