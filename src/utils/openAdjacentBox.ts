/**
 * После слияния высокого уровня: соседние ящики → cobweb / генератор.
 * Уровни 1→2 не открывают ящики; 2→3 и 3→4 — один ящик; 4→5 и выше — два.
 */

import type { GridCell, ItemId } from "../types";
import {
  activeSpawnsChainIdsFromGrid,
  ALL_ITEMS,
  COBWEB_UNKNOWN_ITEM_ID,
  isCobwebUnknownPlaceholder,
  ITEM_CHAINS,
  itemIsGenerator,
  itemIsResourcePickup,
} from "../types";
import { getNeighborIndices } from "./grid";
import { cobwebGridCell, generatorGridCell } from "./gridCells";

/** Минимальный уровень предмета после слияния, с которого открываются ящики. */
const MIN_RESULT_LEVEL_TO_OPEN_BOX = 3;

export function mergeResultBoxesToOpenCount(resultItemLevel: number): number {
  if (resultItemLevel < MIN_RESULT_LEVEL_TO_OPEN_BOX) return 0;
  if (resultItemLevel <= 4) return 1;
  return 2;
}

function manhattan(i: number, j: number, width: number): number {
  const c1 = i % width;
  const r1 = Math.floor(i / width);
  const c2 = j % width;
  const r2 = Math.floor(j / width);
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

function collectBoxNeighbors(
  grid: GridCell[],
  mergeTargetIndex: number,
  width: number,
  height: number,
  dist: 1 | 2
): number[] {
  const out: number[] = [];
  for (let j = 0; j < grid.length; j++) {
    if (grid[j].cellType !== "box") continue;
    const d = manhattan(mergeTargetIndex, j, width);
    if (d === dist) out.push(j);
  }
  return out;
}

function edgeAdjacentBoxes(
  grid: GridCell[],
  mergeTargetIndex: number,
  width: number,
  height: number,
  exclude: Set<number>
): number[] {
  return getNeighborIndices(mergeTargetIndex, width, height).filter(
    (i) => grid[i].cellType === "box" && !exclude.has(i)
  );
}

function poolForOpen(
  grid: GridCell[],
  mergeTargetIndex: number,
  width: number,
  height: number,
  exclude: Set<number>
): number[] {
  let pool = edgeAdjacentBoxes(grid, mergeTargetIndex, width, height, exclude);
  if (pool.length === 0) {
    pool = collectBoxNeighbors(grid, mergeTargetIndex, width, height, 2).filter((i) => !exclude.has(i));
  }
  return pool;
}

/** Содержимое ящика или hint_box после открытия с учётом уже активных генераторов. */
export function resolveOpenedBoxCell(box: GridCell, activeChainIds: Set<string>): GridCell {
  if (box.boxIsGenerator && box.boxGeneratorId) {
    return generatorGridCell(box.boxGeneratorId);
  }
  const itemId = box.boxItem;
  const lvl = box.boxItemLevel;
  const chainId = box.boxChainId;
  if (!itemId || !chainId || lvl < 1 || !ITEM_CHAINS[chainId]) {
    return cobwebGridCell("f1", 1, "fruit");
  }
  if (activeChainIds.has(chainId)) {
    return cobwebGridCell(itemId, lvl, chainId);
  }
  return {
    cellType: "cobweb",
    item: COBWEB_UNKNOWN_ITEM_ID,
    itemLevel: 1,
    chainId: "meta_cobweb",
    boxItem: null,
    boxItemLevel: lvl,
    boxChainId: chainId,
    boxIsGenerator: false,
    boxGeneratorId: null,
  };
}

/** После появления генератора цепочки — раскрыть паутину-заглушку с этой цепочкой. */
export function revealUnknownCobwebsForChain(grid: GridCell[], spawnsChainId: string): GridCell[] {
  return grid.map((cell) => {
    if (!isCobwebUnknownPlaceholder(cell)) return cell;
    const latentChain = cell.boxChainId;
    const latentLv = cell.boxItemLevel >= 1 ? cell.boxItemLevel : 0;
    if (!latentChain || latentChain !== spawnsChainId || latentLv < 1) return cell;
    const ch = ITEM_CHAINS[latentChain];
    if (!ch) return cell;
    const mergeables = ch.items.filter(
      (x) => "level" in x && !itemIsGenerator(x) && !itemIsResourcePickup(x)
    ) as Array<{ id: ItemId; level: number }>;
    const def = mergeables.find((m) => m.level === latentLv) ?? mergeables[latentLv - 1];
    if (!def) return cell;
    return cobwebGridCell(def.id, latentLv, latentChain);
  });
}

export type OpenAdjacentBoxResult = {
  grid: GridCell[];
  unlockedGeneratorItemId: string | null;
  openedCellIndices: number[];
};

export function openAdjacentBoxAfterMerge(
  grid: GridCell[],
  mergeTargetIndex: number,
  resultItemLevel: number,
  width: number,
  height: number
): OpenAdjacentBoxResult {
  const toOpen = mergeResultBoxesToOpenCount(resultItemLevel);
  if (toOpen <= 0) {
    return { grid, unlockedGeneratorItemId: null, openedCellIndices: [] };
  }

  let working = grid.map((c) => ({ ...c }));
  const used = new Set<number>();
  let unlockedGeneratorItemId: string | null = null;
  const openedCellIndices: number[] = [];

  for (let n = 0; n < toOpen; n++) {
    const pool = poolForOpen(working, mergeTargetIndex, width, height, used);
    if (pool.length === 0) break;

    const targetIdx = pool[Math.floor(Math.random() * pool.length)]!;
    const picked = working[targetIdx]!;
    const wasGenBox = picked.cellType === "box" && picked.boxIsGenerator && Boolean(picked.boxGeneratorId);
    const genId = wasGenBox ? picked.boxGeneratorId : null;

    const activeIds = activeSpawnsChainIdsFromGrid(working);
    const resolved = resolveOpenedBoxCell(picked, activeIds);

    working[targetIdx] = resolved;
    used.add(targetIdx);
    openedCellIndices.push(targetIdx);

    if (wasGenBox && genId) {
      unlockedGeneratorItemId = genId;
      const d = ALL_ITEMS[genId];
      if (d && itemIsGenerator(d) && d.spawnsChainId) {
        working = revealUnknownCobwebsForChain(working, d.spawnsChainId);
      }
    }
  }

  return {
    grid: working,
    unlockedGeneratorItemId,
    openedCellIndices,
  };
}
