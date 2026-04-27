/**
 * Фабрики клеток поля (Merge Hotel Empire: box / cobweb / generator / item).
 */

import type { GridCell, ItemId } from "../types";
import { ALL_ITEMS, COBWEB_UNKNOWN_ITEM_ID, itemIsGenerator, itemIsResourcePickup } from "../types";

const NO_BOX_LOOT = {
  boxItem: null as ItemId | null,
  boxItemLevel: 0,
  boxChainId: null as string | null,
  boxIsGenerator: false,
  boxGeneratorId: null as string | null,
};

export function emptyGridCell(): GridCell {
  return { cellType: "empty", item: null, itemLevel: 0, chainId: null, ...NO_BOX_LOOT };
}

export function boxGridCell(loot?: {
  boxItem: ItemId;
  boxItemLevel: number;
  boxChainId: string;
} | null): GridCell {
  if (!loot) {
    return { cellType: "box", item: null, itemLevel: 0, chainId: null, ...NO_BOX_LOOT };
  }
  return {
    cellType: "box",
    item: null,
    itemLevel: 0,
    chainId: null,
    boxItem: loot.boxItem,
    boxItemLevel: loot.boxItemLevel,
    boxChainId: loot.boxChainId,
    boxIsGenerator: false,
    boxGeneratorId: null,
  };
}

/** Ящик-намёк на границе зоны (открывается той же логикой, что и box). */
export function hintBoxGridCell(loot: {
  boxItem: ItemId;
  boxItemLevel: number;
  boxChainId: string;
}): GridCell {
  return {
    cellType: "hint_box",
    item: null,
    itemLevel: 0,
    chainId: null,
    boxItem: loot.boxItem,
    boxItemLevel: loot.boxItemLevel,
    boxChainId: loot.boxChainId,
    boxIsGenerator: false,
    boxGeneratorId: null,
  };
}

/** Закрытый ящик: при открытии слиянием на клетке появится генератор. */
export function generatorBoxGridCell(generatorItemId: string): GridCell {
  return {
    cellType: "box",
    item: null,
    itemLevel: 0,
    chainId: null,
    boxItem: null,
    boxItemLevel: 0,
    boxChainId: null,
    boxIsGenerator: true,
    boxGeneratorId: generatorItemId,
  };
}

export function generatorGridCell(generatorItemId: string): GridCell {
  const d = ALL_ITEMS[generatorItemId];
  const chainId = d && itemIsGenerator(d) ? d.spawnsChainId : null;
  return {
    cellType: "generator",
    item: generatorItemId,
    itemLevel: 0,
    chainId: chainId ?? null,
    ...NO_BOX_LOOT,
  };
}

/** Предмет под паутиной (виден id и уровень, тянуть нельзя). */
export function cobwebGridCell(itemId: ItemId, itemLevel: number, chainId: string): GridCell {
  return { cellType: "cobweb", item: itemId, itemLevel, chainId, ...NO_BOX_LOOT };
}

export function itemGridCell(itemId: ItemId): GridCell {
  const d = ALL_ITEMS[itemId];
  if (!d || itemIsGenerator(d) || itemIsResourcePickup(d)) {
    return { cellType: "item", item: itemId, itemLevel: 1, chainId: "fruit", ...NO_BOX_LOOT };
  }
  return {
    cellType: "item",
    item: itemId,
    itemLevel: d.level,
    chainId: d.chain,
    ...NO_BOX_LOOT,
  };
}

/** Синхронизировать itemLevel / chainId с ALL_ITEMS для item/generator. */
export function withSyncedItemMeta(cell: GridCell): GridCell {
  const stripBoxIfNeeded = (c: GridCell): GridCell =>
    c.cellType === "box" || c.cellType === "hint_box"
      ? c
      : {
          ...c,
          boxItem: null,
          boxItemLevel: 0,
          boxChainId: null,
          boxIsGenerator: false,
          boxGeneratorId: null,
        };

  if (!cell.item) {
    if (cell.cellType === "empty" || cell.cellType === "box" || cell.cellType === "hint_box") {
      return stripBoxIfNeeded({ ...cell, itemLevel: 0, chainId: null });
    }
    return stripBoxIfNeeded(cell);
  }
  const d = ALL_ITEMS[cell.item];
  if (cell.cellType === "generator" && d && itemIsGenerator(d)) {
    return stripBoxIfNeeded({ ...cell, itemLevel: 0, chainId: d.spawnsChainId });
  }
  if (cell.cellType === "item" && d && !itemIsGenerator(d) && !itemIsResourcePickup(d) && "level" in d) {
    return stripBoxIfNeeded({ ...cell, itemLevel: d.level, chainId: d.chain });
  }
  if (cell.cellType === "item" && d && itemIsResourcePickup(d)) {
    return stripBoxIfNeeded({ ...cell, itemLevel: 0, chainId: d.chain });
  }
  if (cell.cellType === "cobweb" && cell.item === COBWEB_UNKNOWN_ITEM_ID) {
    return {
      ...cell,
      itemLevel: 1,
      chainId: "meta_cobweb",
      boxItem: null,
      boxIsGenerator: false,
      boxGeneratorId: null,
    };
  }
  return stripBoxIfNeeded(cell);
}
