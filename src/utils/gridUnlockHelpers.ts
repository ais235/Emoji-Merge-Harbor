/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ALL_ITEMS, ITEM_CHAINS, itemIsGenerator, itemIsResourcePickup, type GridCell, type ItemId } from "../types";
import {
  boxGridCell,
  cobwebGridCell,
  emptyGridCell,
  generatorBoxGridCell,
  generatorGridCell,
  hintBoxGridCell,
  itemGridCell,
  withSyncedItemMeta,
} from "./gridCells";

function normalizeCellFields(c: GridCell): GridCell {
  return withSyncedItemMeta({ ...c });
}

/** Миграция сохранений: старые fog / lock / chest / ключи → новая модель box / item. */
export function migrateLegacyGridCell(entry: unknown): GridCell {
  if (entry !== null && typeof entry === "object" && "cellType" in entry) {
    const o = entry as Record<string, unknown>;
    const rawT = o.cellType;
    const legacyType =
      rawT === "empty" ||
      rawT === "item" ||
      rawT === "generator" ||
      rawT === "lock" ||
      rawT === "fog" ||
      rawT === "chest" ||
      rawT === "box" ||
      rawT === "hint_box" ||
      rawT === "cobweb"
        ? (rawT as string)
        : "empty";

    if (legacyType === "fog" || legacyType === "lock" || legacyType === "chest") {
      return normalizeCellFields(boxGridCell());
    }

    const item = o.item === null ? null : typeof o.item === "string" ? (o.item as ItemId) : null;
    const itemLevel = typeof o.itemLevel === "number" ? o.itemLevel : 0;
    const chainId = typeof o.chainId === "string" ? o.chainId : null;

    if (legacyType === "box" || legacyType === "hint_box") {
      const bi = typeof o.boxItem === "string" ? (o.boxItem as ItemId) : null;
      const bl = typeof o.boxItemLevel === "number" ? o.boxItemLevel : 0;
      const bc = typeof o.boxChainId === "string" ? o.boxChainId : null;
      const isGen = o.boxIsGenerator === true;
      const genId = typeof o.boxGeneratorId === "string" ? o.boxGeneratorId : null;
      if (isGen && genId && ALL_ITEMS[genId] && itemIsGenerator(ALL_ITEMS[genId])) {
        return normalizeCellFields(generatorBoxGridCell(genId));
      }
      if (bi && bc && bl > 0 && ALL_ITEMS[bi]) {
        const loot = { boxItem: bi, boxItemLevel: bl, boxChainId: bc };
        return normalizeCellFields(legacyType === "hint_box" ? hintBoxGridCell(loot) : boxGridCell(loot));
      }
      return normalizeCellFields(boxGridCell());
    }
    if (legacyType === "cobweb" && item) {
      const cid = chainId ?? ALL_ITEMS[item]?.chain ?? null;
      if (!cid) return normalizeCellFields(emptyGridCell());
      return normalizeCellFields(cobwebGridCell(item, itemLevel || 1, cid));
    }
    if (legacyType === "generator" && item) {
      const d = ALL_ITEMS[item];
      if (d && itemIsGenerator(d)) return normalizeCellFields(generatorGridCell(item));
      return normalizeCellFields(emptyGridCell());
    }
    if (legacyType === "item" && item) {
      return normalizeCellFields(itemGridCell(item));
    }
    return normalizeCellFields(emptyGridCell());
  }

  if (entry !== null && typeof entry === "object" && "item" in entry) {
    const o = entry as Record<string, unknown>;
    const rawItem = o.item;
    const item = rawItem === null ? null : typeof rawItem === "string" ? (rawItem as ItemId) : null;
    const raw = o.cellState;
    let cellType: GridCell["cellType"] = "empty";
    if (raw === "locked" || raw === "dirty_2" || raw === "blocked" || raw === "dirty_1") {
      return normalizeCellFields(boxGridCell());
    }
    if (raw === "normal" || raw === undefined || raw === null) {
      if (item) {
        const d = ALL_ITEMS[item];
        cellType = d && itemIsGenerator(d) ? "generator" : "item";
      }
    }
    if (!item) return normalizeCellFields(emptyGridCell());
    const d = ALL_ITEMS[item];
    if (d && itemIsGenerator(d)) return normalizeCellFields(generatorGridCell(item));
    if (d && itemIsResourcePickup(d)) return normalizeCellFields(itemGridCell(item));
    if (d && "level" in d) return normalizeCellFields(itemGridCell(item));
    return normalizeCellFields(emptyGridCell());
  }

  if (entry === null || typeof entry === "string") {
    const legacyItem = entry === null ? null : (entry as ItemId);
    if (!legacyItem) return normalizeCellFields(emptyGridCell());
    const d = ALL_ITEMS[legacyItem];
    if (d && itemIsGenerator(d)) return normalizeCellFields(generatorGridCell(legacyItem));
    return normalizeCellFields(itemGridCell(legacyItem));
  }

  return normalizeCellFields(emptyGridCell());
}
