/**
 * Генераторы на едином поле:
 * открываются по уровню комнаты (HUB_ZONES.unlockLevel) и сразу ставятся в свободную клетку.
 */

import type { GridCell } from "../types";
import { HUB_ZONES } from "../progressionData";
import { ROOM_GENERATOR_DEFS, ZONE_TO_GENERATOR_ID } from "../roomMergeCatalog";
import { generatorGridCell } from "./gridCells";

function collectPlacedGeneratorIds(grid: GridCell[]): Set<string> {
  const s = new Set<string>();
  for (const c of grid) {
    if (c.cellType === "generator" && c.item) s.add(c.item);
  }
  return s;
}

function candidateEmptyIndices(grid: GridCell[], width: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (c.cellType === "empty" && c.item === null) out.push(i);
  }
  const cx = Math.floor(width / 2);
  out.sort((a, b) => {
    const ax = a % width;
    const ay = Math.floor(a / width);
    const bx = b % width;
    const by = Math.floor(b / width);
    const ac = Math.abs(ax - cx) + Math.abs(ay - Math.floor(grid.length / width / 2));
    const bc = Math.abs(bx - cx) + Math.abs(by - Math.floor(grid.length / width / 2));
    return ac - bc || a - b;
  });
  return out;
}

export type AddedGeneratorFx = {
  id: string;
  name: string;
  emoji: string;
  targetIndex: number;
};

export function syncUnlockedGeneratorsForLevel(
  grid: GridCell[],
  width: number,
  height: number,
  playerLevel: number
): { grid: GridCell[]; added: AddedGeneratorFx[] } {
  void height;
  const placed = collectPlacedGeneratorIds(grid);
  const next = grid.map((c) => ({ ...c }));
  const added: AddedGeneratorFx[] = [];

  const unlockableGeneratorIds = HUB_ZONES.filter((z) => z.id !== "hall" && playerLevel >= z.unlockLevel)
    .map((z) => ZONE_TO_GENERATOR_ID[z.id])
    .filter((id): id is string => typeof id === "string");

  for (const genId of unlockableGeneratorIds) {
    if (placed.has(genId)) continue;
    const slot = candidateEmptyIndices(next, width)[0];
    if (slot == null) break;
    next[slot] = generatorGridCell(genId);
    placed.add(genId);
    const def = ROOM_GENERATOR_DEFS[genId];
    added.push({
      id: genId,
      name: def?.name ?? "Новый генератор",
      emoji: def?.emoji ?? "✨",
      targetIndex: slot,
    });
  }

  return { grid: next, added };
}
