/**
 * Стартовое поле: центр — генератор и пустые клетки, кольцо — cobweb (ур.1), остальное — box.
 */

import type { ActiveZone, GridCell, ItemId } from "../types";
import {
  ITEM_CHAINS,
  mergeChainIdForZone,
  generatorItemIdForZone,
  itemIsGenerator,
  itemIsResourcePickup,
} from "../types";
import {
  boxGridCell,
  cobwebGridCell,
  emptyGridCell,
  generatorBoxGridCell,
  generatorGridCell,
} from "./gridCells";
import { hiddenSessionGeneratorIdsForZone } from "./sessionGridProgress";

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
    return ch.items.some((it) => "level" in it && !itemIsGenerator(it) && !itemIsResourcePickup(it));
  });
  const rest = ids.filter((id) => id !== primaryChainId).sort();
  return [primaryChainId, ...rest];
}

/** Предмет цепочки не выше `targetLevel` (если цепочка короче — максимально возможный уровень). */
function boxLootFromChain(chainId: string, targetLevel: number): { boxItem: ItemId; boxItemLevel: number; boxChainId: string } | null {
  const ch = ITEM_CHAINS[chainId];
  if (!ch) return null;
  const mergeables = ch.items.filter(
    (x): x is { id: ItemId; level: number } => "level" in x && !itemIsGenerator(x) && !itemIsResourcePickup(x)
  );
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

/**
 * Ящики начинаются с manhattan > 3. `depth = manhattan - 4` — «кольцо» относительно центра:
 * ближе — чаще ур.1 и уже пул цепочек, дальше — больше цепочек и выше уровень.
 */
function assignBoxCell(manhattan: number, orderedChains: string[]): GridCell {
  const depth = Math.max(0, manhattan - 4);
  const poolSize = Math.min(orderedChains.length, 1 + Math.ceil((depth + 1) / 2));
  const pool = orderedChains.slice(0, Math.max(1, poolSize));
  /** Дальние кольца — более высокий уровень лута (до 5). */
  const level = Math.min(5, 1 + Math.floor(depth / 2));
  const chainId = pool[Math.floor(Math.random() * pool.length)] ?? orderedChains[0];
  const loot = boxLootFromChain(chainId, level);
  if (loot) return boxGridCell(loot);
  const fb = orderedChains[0] ? boxLootFromChain(orderedChains[0], 1) : null;
  return fb ? boxGridCell(fb) : boxGridCell();
}

export function buildInitialGrid(width: number, height: number, zone: ActiveZone): GridCell[] {
  const centerCol = Math.floor(width / 2);
  const centerRow = Math.floor(height / 2);
  const genId = generatorItemIdForZone(zone);
  const chainId = mergeChainIdForZone(zone);
  const cobwebItemId = firstLevelOneItemIdForZone(zone);
  const orderedChains = mergeableChainIdsOrdered(chainId);
  if (!cobwebItemId) {
    const grid: GridCell[] = [];
    for (let i = 0; i < width * height; i++) grid.push(emptyGridCell());
    const gi = centerRow * width + centerCol;
    grid[gi] = generatorGridCell(genId);
    return grid;
  }

  const grid: GridCell[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const manhattan = Math.abs(c - centerCol) + Math.abs(r - centerRow);
      if (manhattan === 0) {
        grid.push(generatorGridCell(genId));
      } else if (manhattan <= 2) {
        grid.push(emptyGridCell());
      } else if (manhattan === 3) {
        const ringLoot = boxLootFromChain(chainId, 1);
        if (ringLoot) {
          grid.push(cobwebGridCell(ringLoot.boxItem, ringLoot.boxItemLevel, ringLoot.boxChainId));
        } else {
          grid.push(cobwebGridCell(cobwebItemId, 1, chainId));
        }
      } else {
        grid.push(assignBoxCell(manhattan, orderedChains));
      }
    }
  }

  const hiddenGens = hiddenSessionGeneratorIdsForZone(zone);
  const centerC = centerCol;
  const centerR = centerRow;
  const boxIndicesByManhattan = (minM: number, maxM: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]!.cellType !== "box") continue;
      const c = i % width;
      const r = Math.floor(i / width);
      const m = Math.abs(c - centerC) + Math.abs(r - centerR);
      if (m >= minM && m <= maxM) out.push(i);
    }
    return out;
  };

  let firstGeneratorBoxIndex: number | null = null;
  if (hiddenGens[0]) {
    const poolC = boxIndicesByManhattan(5, 6);
    const idx = poolC[Math.floor(Math.random() * poolC.length)];
    if (idx !== undefined) {
      grid[idx] = generatorBoxGridCell(hiddenGens[0]!);
      firstGeneratorBoxIndex = idx;
    }
  }
  if (hiddenGens[1]) {
    const poolD = boxIndicesByManhattan(7, 8).filter((i) => i !== firstGeneratorBoxIndex);
    let idx = poolD[Math.floor(Math.random() * poolD.length)];
    if (idx === undefined) {
      const wide = boxIndicesByManhattan(5, 9).filter((i) => i !== firstGeneratorBoxIndex);
      idx = wide[Math.floor(Math.random() * wide.length)]!;
    }
    if (idx !== undefined) grid[idx] = generatorBoxGridCell(hiddenGens[1]!);
  }

  return grid;
}
