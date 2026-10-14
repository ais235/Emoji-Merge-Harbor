/**
 * Раскрытие содержимого ящика: `box` / `hint_box` → предмет под паутиной или генератор.
 * Порядок и темп открытия задаёт зональная прогрессия (`mergeFieldProgress.ts`).
 */

import type { GridCell } from "../types";
import { COBWEB_UNKNOWN_ITEM_ID, isCobwebUnknownPlaceholder, ITEM_CHAINS, itemIsMergeable } from "../types";
import { cobwebGridCell, generatorGridCell } from "./gridCells";

/** Содержимое ящика или hint_box после открытия с учётом уже активных генераторов. */
export function resolveOpenedBoxCell(box: GridCell, activeChainIds: Set<string>): GridCell {
  if (box.boxIsGenerator && box.boxGeneratorId) {
    return generatorGridCell(box.boxGeneratorId);
  }
  const itemId = box.boxItem;
  const lvl = box.boxItemLevel;
  const chainId = box.boxChainId;
  if (!itemId || !chainId || lvl < 1 || !ITEM_CHAINS[chainId]) {
    return cobwebGridCell("hl1", 1, "hall_tea");
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
    const mergeables = ch.items.filter(itemIsMergeable);
    const def = mergeables.find((m) => m.level === latentLv) ?? mergeables[latentLv - 1];
    if (!def) return cell;
    return cobwebGridCell(def.id, latentLv, latentChain);
  });
}
