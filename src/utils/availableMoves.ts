import type { GridCell, Order } from "../types";
import { ALL_ITEMS, ITEM_CHAINS, isObstacleCellState } from "../types";

/**
 * Есть ли слияние или выполнимый заказ (без учёта пустых клеток и спавна).
 */
export function hasMergeOrCompletableOrder(
  grid: GridCell[],
  orders?: Pick<Order, "requiredItemId">[]
): boolean {
  if (orders?.length) {
    for (const o of orders) {
      if (grid.some((c) => c.item === o.requiredItemId)) return true;
    }
  }

  const n = grid.length;
  for (let i = 0; i < n; i++) {
    if (isObstacleCellState(grid[i].cellState)) continue;
    const id = grid[i].item;
    if (!id) continue;
    const def = ALL_ITEMS[id];
    if (!def) continue;
    const chain = ITEM_CHAINS[def.chain];
    const nextItem = chain.items[def.level];
    if (!nextItem) continue;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (isObstacleCellState(grid[j].cellState)) continue;
      if (grid[j].item === id) return true;
    }
  }

  return false;
}

/**
 * Есть ли «эффективный» ход: слияние / заказ, или пустая клетка при положительной энергии (спавн).
 * При энергии 0 пустые клетки не считаются ходом.
 */
export function hasEffectiveMoves(
  grid: GridCell[],
  orders: Pick<Order, "requiredItemId">[] | undefined,
  energy: number
): boolean {
  if (hasMergeOrCompletableOrder(grid, orders)) return true;
  if (energy > 0 && grid.some((c) => c.item === null)) return true;
  return false;
}

/**
 * Есть ли ход с точки зрения сетки (пустая клетка или слияние / заказ), без учёта энергии.
 */
export function hasAvailableMoves(
  grid: GridCell[],
  orders?: Pick<Order, "requiredItemId">[]
): boolean {
  return hasEffectiveMoves(grid, orders, Number.POSITIVE_INFINITY);
}
