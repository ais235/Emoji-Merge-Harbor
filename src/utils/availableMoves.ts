import type { GridCell, Order } from "../types";
import { ALL_ITEMS, ITEM_CHAINS, isOpenCellType, itemIsGenerator, itemIsResourcePickup, orderCanDeliverFromGrid } from "../types";

function mergeablePairExists(grid: GridCell[]): boolean {
  const n = grid.length;
  for (let i = 0; i < n; i++) {
    const a = grid[i];
    if (a.cellType !== "item" || !a.item) continue;
    const defA = ALL_ITEMS[a.item];
    if (!defA || itemIsGenerator(defA) || itemIsResourcePickup(defA)) continue;
    const chain = ITEM_CHAINS[defA.chain];
    if (!chain?.items[defA.level]) continue;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = grid[j];
      if (!b.item || b.item !== a.item) continue;
      if (b.cellType === "item") return true;
      if (b.cellType === "cobweb" && defA.level === b.itemLevel) return true;
    }
  }
  return false;
}

function hasGeneratorSpawnMove(grid: GridCell[], energy: number): boolean {
  if (energy <= 0) return false;
  const hasEmpty = grid.some((c) => isOpenCellType(c.cellType) && c.cellType === "empty" && c.item === null);
  if (!hasEmpty) return false;
  return grid.some((c) => {
    if (c.cellType !== "generator" || !c.item) return false;
    const d = ALL_ITEMS[c.item];
    return Boolean(d && itemIsGenerator(d));
  });
}

function hasResourcePickupClick(grid: GridCell[]): boolean {
  for (const c of grid) {
    if (!isOpenCellType(c.cellType)) continue;
    if (!c.item) continue;
    const def = ALL_ITEMS[c.item];
    if (def && itemIsResourcePickup(def)) return true;
  }
  return false;
}

/**
 * Есть ли эффективный ход: слияние / заказ / генератор (энергия) / ресурс.
 */
export function hasEffectiveMoves(
  grid: GridCell[],
  orders: Order[] | undefined,
  energy: number,
  _generatorMaxChargesUnused: number,
  _width = 9,
  _height = 12
): boolean {
  if (orders?.length) {
    for (const o of orders) {
      if (orderCanDeliverFromGrid(grid, o)) return true;
    }
  }
  if (mergeablePairExists(grid)) return true;
  if (hasGeneratorSpawnMove(grid, energy)) return true;
  if (hasResourcePickupClick(grid)) return true;
  return false;
}

export function hasAvailableMoves(grid: GridCell[], orders?: Order[]): boolean {
  return hasEffectiveMoves(grid, orders, Number.POSITIVE_INFINITY, 0, 9, 12);
}
