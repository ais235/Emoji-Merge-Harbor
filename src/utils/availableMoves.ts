import type { GridCell, Order } from "../types";
import {
  ALL_ITEMS,
  INITIAL_GENERATOR_CHARGES,
  ITEM_CHAINS,
  isObstacleCellState,
  itemIsGenerator,
  itemIsResourcePickup,
  orderCanDeliverFromGrid,
} from "../types";

/**
 * Есть ли слияние или выполнимый заказ (без учёта пустых клеток и спавна).
 */
export function hasMergeOrCompletableOrder(grid: GridCell[], orders?: Order[]): boolean {
  if (orders?.length) {
    for (const o of orders) {
      if (orderCanDeliverFromGrid(grid, o)) return true;
    }
  }

  const n = grid.length;
  for (let i = 0; i < n; i++) {
    if (isObstacleCellState(grid[i].cellState)) continue;
    const id = grid[i].item;
    if (!id) continue;
    const def = ALL_ITEMS[id];
    if (!def || itemIsGenerator(def) || itemIsResourcePickup(def)) continue;
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

function hasGeneratorSpawnMove(grid: GridCell[], energy: number, _generatorMaxCharges: number): boolean {
  if (energy <= 0) return false;
  const hasEmptyNormal = grid.some(
    (c) => !isObstacleCellState(c.cellState) && c.item === null
  );
  if (!hasEmptyNormal) return false;
  for (let i = 0; i < grid.length; i++) {
    if (isObstacleCellState(grid[i].cellState)) continue;
    const id = grid[i].item;
    if (!id) continue;
    const def = ALL_ITEMS[id];
    if (def && itemIsGenerator(def)) return true;
  }
  return false;
}

function hasResourcePickupClick(grid: GridCell[]): boolean {
  for (const c of grid) {
    if (isObstacleCellState(c.cellState)) continue;
    if (!c.item) continue;
    const def = ALL_ITEMS[c.item];
    if (def && itemIsResourcePickup(def)) return true;
  }
  return false;
}

/**
 * Есть ли «эффективный» ход: слияние / заказ, или клик по генератору при наличии пустой клетки.
 */
export function hasEffectiveMoves(
  grid: GridCell[],
  orders: Order[] | undefined,
  energy: number,
  generatorMaxCharges: number
): boolean {
  if (hasMergeOrCompletableOrder(grid, orders)) return true;
  if (hasGeneratorSpawnMove(grid, energy, generatorMaxCharges)) return true;
  if (hasResourcePickupClick(grid)) return true;
  return false;
}

/**
 * Есть ли ход с точки зрения сетки (пустая клетка или слияние / заказ), без учёта энергии.
 */
export function hasAvailableMoves(grid: GridCell[], orders?: Order[]): boolean {
  return hasEffectiveMoves(grid, orders, Number.POSITIVE_INFINITY, INITIAL_GENERATOR_CHARGES);
}
