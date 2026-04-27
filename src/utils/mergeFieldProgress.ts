/**
 * Прогресс поля: зона 1 — после слияний; зоны 2 и 3 — после выполненных заказов.
 */

import type { FieldProgressState, GridCell } from "../types";
import { ALL_ITEMS, isSealedFieldCell, itemIsGenerator } from "../types";
import {
  buildAllUnlockQueues,
  fieldZoneEntry,
  gridCenterIndex,
  mergeZone1Params,
  type FieldUnlockZoneId,
} from "./fieldZones";
import { resolveOpenedBoxCell, revealUnknownCobwebsForChain } from "./openAdjacentBox";

export type MergeFieldProgressResult = {
  grid: GridCell[];
  fieldProgress: FieldProgressState;
  unlockedGeneratorItemId: string | null;
  openedCellIndices: number[];
  zoneJustCompleted: { zoneId: FieldUnlockZoneId; name: string } | null;
};

function activeSpawnsChainIdsFromWorking(grid: GridCell[]): Set<string> {
  const activeIds = new Set<string>();
  for (const c of grid) {
    if (c.cellType !== "generator" || !c.item) continue;
    const d = ALL_ITEMS[c.item];
    if (d && itemIsGenerator(d) && d.spawnsChainId) activeIds.add(d.spawnsChainId);
  }
  return activeIds;
}

function openNextFromQueue(
  grid: GridCell[],
  zoneId: FieldUnlockZoneId,
  queues: FieldProgressState["unlockQueues"],
  activeChainIds: Set<string>
): {
  grid: GridCell[];
  openedIndex: number | null;
  unlockedGeneratorItemId: string | null;
} {
  const queue = queues[zoneId];
  if (!queue.length) return { grid, openedIndex: null, unlockedGeneratorItemId: null };

  const nextIdx = queue.find((idx) => isSealedFieldCell(grid[idx]!));
  if (nextIdx === undefined) return { grid, openedIndex: null, unlockedGeneratorItemId: null };

  const box = grid[nextIdx]!;
  const wasGenBox = box.boxIsGenerator && Boolean(box.boxGeneratorId);
  const genId = wasGenBox ? box.boxGeneratorId : null;

  let nextGrid = grid.map((c) => ({ ...c }));
  const resolved = resolveOpenedBoxCell(box, activeChainIds);
  nextGrid[nextIdx] = resolved;

  let unlockedGeneratorItemId: string | null = null;
  if (wasGenBox && genId) {
    unlockedGeneratorItemId = genId;
    const d = ALL_ITEMS[genId];
    if (d && itemIsGenerator(d) && d.spawnsChainId) {
      nextGrid = revealUnknownCobwebsForChain(nextGrid, d.spawnsChainId);
    }
  }

  return { grid: nextGrid, openedIndex: nextIdx, unlockedGeneratorItemId };
}

function zoneFullyExplored(grid: GridCell[], zoneId: FieldUnlockZoneId, width: number, height: number): boolean {
  const z = fieldZoneEntry(zoneId);
  const center = gridCenterIndex(width, height);
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const c = grid[i]!;
    const dMan =
      Math.abs((i % width) - (center % width)) + Math.abs(Math.floor(i / width) - Math.floor(center / width));
    if (dMan < z.distMin || dMan > z.distMax) continue;
    if (isSealedFieldCell(c)) return false;
  }
  return true;
}

/** После слияния: только зона 1 (слияния ур. mergeMinLevel+ по темпу mergesPerTile). */
export function handleMergeFieldProgress(
  grid: GridCell[],
  fieldProgress: FieldProgressState,
  resultLevel: number,
  width: number,
  height: number
): MergeFieldProgressResult {
  const z1 = mergeZone1Params();
  let fp: FieldProgressState = {
    ...fieldProgress,
    unlockQueues: {
      zone_1: [...fieldProgress.unlockQueues.zone_1],
      zone_2: [...fieldProgress.unlockQueues.zone_2],
      zone_3: [...fieldProgress.unlockQueues.zone_3],
    },
  };

  let working = grid.map((c) => ({ ...c }));
  const openedCellIndices: number[] = [];
  let unlockedGeneratorItemId: string | null = null;
  let zoneJustCompleted: { zoneId: FieldUnlockZoneId; name: string } | null = null;

  if (resultLevel < z1.mergeMinLevel) {
    return {
      grid: working,
      fieldProgress: fp,
      unlockedGeneratorItemId: null,
      openedCellIndices: [],
      zoneJustCompleted: null,
    };
  }

  const key = "zone1MergeProgress" as const;
  const prev = fp[key];
  fp = { ...fp, [key]: prev + 1 };
  const counter = fp[key];

  if (counter < z1.unlocksAfterMerges) {
    return {
      grid: working,
      fieldProgress: fp,
      unlockedGeneratorItemId: null,
      openedCellIndices: [],
      zoneJustCompleted: null,
    };
  }
  const afterGate = counter - z1.unlocksAfterMerges;
  if (afterGate % z1.mergesPerTile !== 0) {
    return {
      grid: working,
      fieldProgress: fp,
      unlockedGeneratorItemId: null,
      openedCellIndices: [],
      zoneJustCompleted: null,
    };
  }

  const activeIds = activeSpawnsChainIdsFromWorking(working);
  const beforeExplored = zoneFullyExplored(working, "zone_1", width, height);
  const r = openNextFromQueue(working, "zone_1", fp.unlockQueues, activeIds);
  if (r.openedIndex != null) {
    working = r.grid;
    openedCellIndices.push(r.openedIndex);
    if (r.unlockedGeneratorItemId) unlockedGeneratorItemId = r.unlockedGeneratorItemId;
    if (!beforeExplored && zoneFullyExplored(working, "zone_1", width, height)) {
      zoneJustCompleted = { zoneId: "zone_1", name: z1.name };
    }
  }

  return {
    grid: working,
    fieldProgress: fp,
    unlockedGeneratorItemId,
    openedCellIndices,
    zoneJustCompleted,
  };
}

/** После полного выполнения заказа: зоны 2 и 3 по счётчику заказов. */
export function handleOrderFieldProgress(
  grid: GridCell[],
  fieldProgress: FieldProgressState,
  width: number,
  height: number
): MergeFieldProgressResult {
  let fp: FieldProgressState = {
    ...fieldProgress,
    ordersForFieldProgress: fieldProgress.ordersForFieldProgress + 1,
    unlockQueues: {
      zone_1: [...fieldProgress.unlockQueues.zone_1],
      zone_2: [...fieldProgress.unlockQueues.zone_2],
      zone_3: [...fieldProgress.unlockQueues.zone_3],
    },
  };

  let working = grid.map((c) => ({ ...c }));
  const openedCellIndices: number[] = [];
  let unlockedGeneratorItemId: string | null = null;
  let zoneJustCompleted: { zoneId: FieldUnlockZoneId; name: string } | null = null;

  const n = fp.ordersForFieldProgress;

  const tryZone = (zoneId: FieldUnlockZoneId): void => {
    const z = fieldZoneEntry(zoneId);
    if (z.opensVia !== "orders" || !z.ordersPerTile) return;
    if (n <= 0) return;
    if (n % z.ordersPerTile !== 0) return;

    const activeIds = activeSpawnsChainIdsFromWorking(working);
    const beforeExplored = zoneFullyExplored(working, zoneId, width, height);
    const r = openNextFromQueue(working, zoneId, fp.unlockQueues, activeIds);
    if (r.openedIndex == null) return;

    working = r.grid;
    openedCellIndices.push(r.openedIndex);
    if (r.unlockedGeneratorItemId) unlockedGeneratorItemId = r.unlockedGeneratorItemId;

    if (!beforeExplored && zoneFullyExplored(working, zoneId, width, height)) {
      zoneJustCompleted = { zoneId, name: z.name };
    }
  };

  tryZone("zone_2");
  tryZone("zone_3");

  return {
    grid: working,
    fieldProgress: fp,
    unlockedGeneratorItemId,
    openedCellIndices,
    zoneJustCompleted,
  };
}

export function emptyFieldProgress(): FieldProgressState {
  return {
    unlockQueues: { zone_1: [], zone_2: [], zone_3: [] },
    zone1MergeProgress: 0,
    ordersForFieldProgress: 0,
  };
}

function countSealedInZone(grid: GridCell[], width: number, height: number, zoneId: FieldUnlockZoneId): number {
  const z = fieldZoneEntry(zoneId);
  const center = gridCenterIndex(width, height);
  let sealed = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const dMan =
      Math.abs((i % width) - (center % width)) + Math.abs(Math.floor(i / width) - Math.floor(center / width));
    if (dMan < z.distMin || dMan > z.distMax) continue;
    if (isSealedFieldCell(grid[i]!)) sealed += 1;
  }
  return sealed;
}

/** Миграция сохранений без fieldProgress или со старыми полями. */
export function migrateFieldProgressFromGrid(
  grid: GridCell[],
  width: number,
  height: number,
  totalOrdersCompletedHint = 0
): FieldProgressState {
  const centerIdx = gridCenterIndex(width, height);
  const queues = buildAllUnlockQueues(grid, width, height, centerIdx);
  const z1 = mergeZone1Params();

  const estimateMergeCounter = (zoneId: FieldUnlockZoneId): number => {
    const z = fieldZoneEntry(zoneId);
    const indices: number[] = [];
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const dMan =
        Math.abs((i % width) - (centerIdx % width)) +
        Math.abs(Math.floor(i / width) - Math.floor(centerIdx / width));
      if (dMan >= z.distMin && dMan <= z.distMax) indices.push(i);
    }
    if (indices.length === 0) return z1.unlocksAfterMerges;
    let sealed = 0;
    for (const i of indices) {
      if (isSealedFieldCell(grid[i]!)) sealed += 1;
    }
    const opened = indices.length - sealed;
    return z1.unlocksAfterMerges + opened * z1.mergesPerTile;
  };

  const z2 = fieldZoneEntry("zone_2");
  const z3 = fieldZoneEntry("zone_3");
  const opened2cells =
    indicesInZoneCount(width, height, "zone_2") - countSealedInZone(grid, width, height, "zone_2");
  const opened3cells =
    indicesInZoneCount(width, height, "zone_3") - countSealedInZone(grid, width, height, "zone_3");

  const minOrdersFromZ2 =
    z2.opensVia === "orders" && z2.ordersPerTile
      ? Math.max(0, opened2cells) * z2.ordersPerTile
      : 0;
  const minOrdersFromZ3 =
    z3.opensVia === "orders" && z3.ordersPerTile
      ? Math.max(0, opened3cells) * z3.ordersPerTile
      : 0;

  const ordersGuess = Math.max(totalOrdersCompletedHint, minOrdersFromZ2, minOrdersFromZ3);

  return {
    unlockQueues: queues,
    zone1MergeProgress: estimateMergeCounter("zone_1"),
    ordersForFieldProgress: ordersGuess,
  };
}

function indicesInZoneCount(width: number, height: number, zoneId: FieldUnlockZoneId): number {
  const z = fieldZoneEntry(zoneId);
  const center = gridCenterIndex(width, height);
  let c = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const dMan =
      Math.abs((i % width) - (center % width)) + Math.abs(Math.floor(i / width) - Math.floor(center / width));
    if (dMan >= z.distMin && dMan <= z.distMax) c += 1;
  }
  return c;
}
