/**
 * Зональная прогрессия поля (Manhattan от центра): очереди открытия.
 * Зона 1 — от слияний; зоны 2 и 3 — от выполненных заказов (без дедлока по генератору).
 */

import type { GridCell } from "../types";
import { isSealedFieldCell } from "../types";

export const FIELD_CONSTANTS = {
  ZONE_1_MERGES_PER_TILE: 2,
  /** Первое открытие клетки зоны 1 после стольких подходящих слияний (0 — сразу по кратности). */
  ZONE_1_UNLOCKS_AFTER_MERGES: 0,
  ZONE_2_ORDERS_PER_TILE: 3,
  ZONE_3_ORDERS_PER_TILE: 8,
  HINT_BOX_COUNT_PER_ZONE: 3,
  GENERATOR_BOX_DIST_ZONE2: 5,
  GENERATOR_BOX_DIST_ZONE3: 7,
} as const;

export type FieldUnlockZoneId = "zone_1" | "zone_2" | "zone_3";

export type ZoneOpensVia = "start" | "merges" | "orders";

export interface FieldZoneEntry {
  id: FieldUnlockZoneId | "zone_0";
  name: string;
  distMin: number;
  distMax: number;
  opensVia: ZoneOpensVia;
  mergeMinLevel?: number;
  unlocksAfterMerges?: number;
  mergesPerTile?: number;
  ordersPerTile?: number;
}

export const FIELD_ZONES: FieldZoneEntry[] = [
  { id: "zone_0", name: "Стартовая зона", distMin: 0, distMax: 2, opensVia: "start" },
  {
    id: "zone_1",
    name: "Ближняя зона",
    distMin: 3,
    distMax: 4,
    opensVia: "merges",
    mergeMinLevel: 2,
    unlocksAfterMerges: FIELD_CONSTANTS.ZONE_1_UNLOCKS_AFTER_MERGES,
    mergesPerTile: FIELD_CONSTANTS.ZONE_1_MERGES_PER_TILE,
  },
  {
    id: "zone_2",
    name: "Средняя зона",
    distMin: 5,
    distMax: 6,
    opensVia: "orders",
    ordersPerTile: FIELD_CONSTANTS.ZONE_2_ORDERS_PER_TILE,
  },
  {
    id: "zone_3",
    name: "Дальняя зона",
    distMin: 7,
    distMax: 9,
    opensVia: "orders",
    ordersPerTile: FIELD_CONSTANTS.ZONE_3_ORDERS_PER_TILE,
  },
];

export const UNLOCKABLE_FIELD_ZONE_IDS: FieldUnlockZoneId[] = ["zone_1", "zone_2", "zone_3"];

export function fieldZoneEntry(id: FieldUnlockZoneId | "zone_0"): FieldZoneEntry {
  const z = FIELD_ZONES.find((x) => x.id === id);
  if (!z) throw new Error(`Unknown field zone ${id}`);
  return z;
}

/** Параметры слияний только для зоны 1. */
export function mergeZone1Params(): {
  mergeMinLevel: number;
  unlocksAfterMerges: number;
  mergesPerTile: number;
  name: string;
} {
  const z = fieldZoneEntry("zone_1");
  if (z.opensVia !== "merges" || z.mergeMinLevel == null || z.mergesPerTile == null) {
    throw new Error("zone_1 must be merges zone");
  }
  return {
    mergeMinLevel: z.mergeMinLevel,
    unlocksAfterMerges: z.unlocksAfterMerges ?? 0,
    mergesPerTile: z.mergesPerTile,
    name: z.name,
  };
}

export function manhattanFromCenter(idx: number, centerIdx: number, width: number): number {
  const c = idx % width;
  const r = Math.floor(idx / width);
  const cc = centerIdx % width;
  const cr = Math.floor(centerIdx / width);
  return Math.abs(c - cc) + Math.abs(r - cr);
}

export function gridCenterIndex(width: number, height: number): number {
  const centerCol = Math.floor(width / 2);
  const centerRow = Math.floor(height / 2);
  return centerRow * width + centerCol;
}

export function indicesInManhattanZone(
  width: number,
  height: number,
  centerIdx: number,
  distMin: number,
  distMax: number
): number[] {
  const out: number[] = [];
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const d = manhattanFromCenter(i, centerIdx, width);
    if (d >= distMin && d <= distMax) out.push(i);
  }
  return out;
}

export function fractionZoneExplored(
  grid: GridCell[],
  width: number,
  height: number,
  centerIdx: number,
  zoneId: FieldUnlockZoneId | "zone_0"
): number {
  const meta = FIELD_ZONES.find((z) => z.id === zoneId);
  if (!meta) return 1;
  const indices = indicesInManhattanZone(width, height, centerIdx, meta.distMin, meta.distMax);
  if (indices.length === 0) return 1;
  let open = 0;
  for (const i of indices) {
    if (!isSealedFieldCell(grid[i]!)) open += 1;
  }
  return open / indices.length;
}

export function buildUnlockQueueForZone(
  zoneId: FieldUnlockZoneId,
  grid: GridCell[],
  centerIdx: number,
  width: number
): number[] {
  const z = fieldZoneEntry(zoneId);
  return grid
    .map((cell, idx) => ({ cell, idx }))
    .filter(({ cell, idx }) => {
      const dist = manhattanFromCenter(idx, centerIdx, width);
      return dist >= z.distMin && dist <= z.distMax && isSealedFieldCell(cell);
    })
    .sort((a, b) => {
      const distA = manhattanFromCenter(a.idx, centerIdx, width);
      const distB = manhattanFromCenter(b.idx, centerIdx, width);
      if (distA !== distB) return distA - distB;
      return a.idx - b.idx;
    })
    .map(({ idx }) => idx);
}

export function buildAllUnlockQueues(
  grid: GridCell[],
  width: number,
  height: number,
  centerIdx: number
): Record<FieldUnlockZoneId, number[]> {
  return {
    zone_1: buildUnlockQueueForZone("zone_1", grid, centerIdx, width),
    zone_2: buildUnlockQueueForZone("zone_2", grid, centerIdx, width),
    zone_3: buildUnlockQueueForZone("zone_3", grid, centerIdx, width),
  };
}
