/**
 * Стартовое поле: зона 0 (центр) — генератор и пустые клетки; дальше концентрические зоны из ящиков.
 */

import type { ActiveZone, GridCell, ItemId } from "../types";
import {
  ITEM_CHAINS,
  mergeChainIdForZone,
  generatorItemIdForZone,
  itemIsMergeable,
} from "../types";
import type { FieldProgressState } from "../types";
import { boxGridCell, emptyGridCell, generatorGridCell, hintBoxGridCell } from "./gridCells";
import { buildAllUnlockQueues, FIELD_CONSTANTS, fieldZoneEntry, gridCenterIndex } from "./fieldZones";
import { emptyFieldProgress } from "./mergeFieldProgress";

function firstLevelOneItemIdForZone(zone: ActiveZone): string | null {
  const ch = ITEM_CHAINS[mergeChainIdForZone(zone)];
  const it = ch?.items[0];
  if (!it || !("level" in it) || it.level !== 1) return null;
  return it.id;
}

/** Цепочки со слиянием (без служебных ключей), основная зоны — первая. */
function mergeableChainIdsOrdered(primaryChainId: string): string[] {
  const ids = Object.keys(ITEM_CHAINS).filter((id) => {
    if (id.startsWith("__")) return false;
    const ch = ITEM_CHAINS[id];
    if (!ch) return false;
    return ch.items.some(itemIsMergeable);
  });
  const rest = ids.filter((id) => id !== primaryChainId).sort();
  return [primaryChainId, ...rest];
}

function boxLootFromChain(
  chainId: string,
  targetLevel: number
): { boxItem: ItemId; boxItemLevel: number; boxChainId: string } | null {
  const ch = ITEM_CHAINS[chainId];
  if (!ch) return null;
  const mergeables = ch.items.filter(itemIsMergeable);
  if (!mergeables.length) return null;
  const maxLv = Math.max(...mergeables.map((m) => m.level));
  let L = Math.min(targetLevel, maxLv);
  while (L >= 1) {
    const it = mergeables.find((m) => m.level === L);
    if (it) return { boxItem: it.id, boxItemLevel: it.level, boxChainId: chainId };
    L -= 1;
  }
  const first = mergeables[0];
  return first ? { boxItem: first.id, boxItemLevel: first.level, boxChainId: chainId } : null;
}

function assignBoxCell(manhattan: number, orderedChains: string[], row: number, col: number): GridCell {
  const depth = Math.max(0, manhattan - 4);
  // Быстрее расширяем пул цепочек, чтобы закрытые клетки не были однотипными.
  const poolSize = Math.min(orderedChains.length, 2 + depth);
  const pool = orderedChains.slice(0, Math.max(1, poolSize));
  const levelMax = Math.min(5, 2 + Math.floor(depth / 2));
  const levelMin = Math.max(1, levelMax - 2);
  const level = levelMin + Math.floor(Math.random() * (levelMax - levelMin + 1));
  // Шахматно-детерминированный выбор цепочки + лёгкая случайность.
  const seed = (row * 31 + col * 17 + manhattan * 7) % Math.max(1, pool.length);
  const offset = Math.random() < 0.35 ? 1 : 0;
  const chainId = pool[(seed + offset) % pool.length] ?? orderedChains[0];
  const loot = boxLootFromChain(chainId, level);
  if (loot) return boxGridCell(loot);
  const fb = orderedChains[0] ? boxLootFromChain(orderedChains[0], 1) : null;
  return fb ? boxGridCell(fb) : boxGridCell();
}

function manhattan(idx: number, centerIdx: number, width: number): number {
  const c = idx % width;
  const r = Math.floor(idx / width);
  const cc = centerIdx % width;
  const cr = Math.floor(centerIdx / width);
  return Math.abs(c - cc) + Math.abs(r - cr);
}

function maxManhattanPresentInZone(
  width: number,
  height: number,
  centerIdx: number,
  distMin: number,
  distMax: number
): number {
  let mx = -1;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const d = manhattan(i, centerIdx, width);
    if (d < distMin || d > distMax) continue;
    mx = Math.max(mx, d);
  }
  return mx;
}

function applyHintBoxes(
  grid: GridCell[],
  width: number,
  height: number,
  centerIdx: number
): void {
  const hintCount = FIELD_CONSTANTS.HINT_BOX_COUNT_PER_ZONE;
  for (const zid of ["zone_1", "zone_2", "zone_3"] as const) {
    const z = fieldZoneEntry(zid);
    const shellD = maxManhattanPresentInZone(width, height, centerIdx, z.distMin, z.distMax);
    if (shellD < 0) continue;
    const outer: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      const d = manhattan(i, centerIdx, width);
      if (d !== shellD) continue;
      const c = grid[i]!;
      if (c.cellType !== "box" || c.boxIsGenerator) continue;
      if (!c.boxItem || !c.boxChainId || c.boxItemLevel < 1) continue;
      outer.push(i);
    }
    outer.sort((a, b) => a - b);
    for (const k of outer.slice(0, hintCount)) {
      const c = grid[k]!;
      if (c.boxItem && c.boxChainId && c.boxItemLevel >= 1) {
        grid[k] = hintBoxGridCell({
          boxItem: c.boxItem,
          boxItemLevel: c.boxItemLevel,
          boxChainId: c.boxChainId,
        });
      }
    }
  }
}

export interface BuildInitialGridResult {
  grid: GridCell[];
  fieldProgress: FieldProgressState;
}

export function buildInitialGrid(width: number, height: number, zone: ActiveZone): BuildInitialGridResult {
  const centerIdx = gridCenterIndex(width, height);
  const centerCol = Math.floor(width / 2);
  const centerRow = Math.floor(height / 2);
  const genId = generatorItemIdForZone(zone);
  const chainId = mergeChainIdForZone(zone);
  const cobwebItemId = firstLevelOneItemIdForZone(zone);
  const orderedChains = mergeableChainIdsOrdered(chainId);

  if (!cobwebItemId) {
    const grid: GridCell[] = [];
    for (let i = 0; i < width * height; i++) grid.push(emptyGridCell());
    grid[centerIdx] = generatorGridCell(genId);
    const fp = { ...emptyFieldProgress(), unlockQueues: buildAllUnlockQueues(grid, width, centerIdx) };
    return { grid, fieldProgress: fp };
  }

  const grid: GridCell[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const m = Math.abs(c - centerCol) + Math.abs(r - centerRow);
      if (m === 0) {
        grid.push(generatorGridCell(genId));
      } else if (m <= 2) {
        grid.push(emptyGridCell());
      } else {
        grid.push(assignBoxCell(m, orderedChains, r, c));
      }
    }
  }

  applyHintBoxes(grid, width, height, centerIdx);

  const fieldProgress: FieldProgressState = {
    ...emptyFieldProgress(),
    unlockQueues: buildAllUnlockQueues(grid, width, centerIdx),
  };

  return { grid, fieldProgress };
}
