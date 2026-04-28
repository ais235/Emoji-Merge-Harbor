/**
 * Прогрессия генераторов на едином поле:
 * когда условие достигнуто, на поле появляется видимый "сундук-генератор".
 */

import type { GridCell, ProgressionState } from "../types";
import { ROOM_GENERATOR_DEFS } from "../roomMergeCatalog";
import { generatorBoxGridCell } from "./gridCells";

export type GeneratorPlacementHint = "center" | "top" | "bottom" | "left" | "right";

export interface GeneratorProgressDef {
  id: string;
  spawnsChainId: string;
  unlockCondition:
    | { type: "player_level"; value: number }
    | { type: "orders_completed"; value: number; minLevel?: number }
    | { type: "item_collected"; value: string };
  placementHint: GeneratorPlacementHint;
}

/** Стартовый генератор зала не входит — остальные появляются по прогрессу. */
export const GENERATOR_PROGRESSION_LIST: GeneratorProgressDef[] = (
  [
    ["gen_kitchen", "kitchen_meal", { type: "player_level" as const, value: 2 }, "top" as const],
    ["gen_bedroom", "bedroom_cozy", { type: "player_level" as const, value: 3 }, "left" as const],
    ["gen_bathroom", "bathroom_fresh", { type: "orders_completed" as const, value: 8, minLevel: 4 }, "right" as const],
    ["gen_terrace", "terrace_plants", { type: "player_level" as const, value: 5 }, "top" as const],
    ["gen_office", "office_work", { type: "orders_completed" as const, value: 25, minLevel: 8 }, "center" as const],
    ["gen_lounge", "lounge_drinks", { type: "player_level" as const, value: 7 }, "bottom" as const],
    ["gen_secret", "secret_mystic", { type: "player_level" as const, value: 10 }, "center" as const],
    ["gen_garden", "garden_harvest", { type: "orders_completed" as const, value: 40, minLevel: 12 }, "bottom" as const],
  ] as const
).map(([id, spawnsChainId, unlockCondition, placementHint]) => ({
  id,
  spawnsChainId,
  unlockCondition,
  placementHint,
}));

function conditionMet(
  def: GeneratorProgressDef,
  prog: Pick<ProgressionState, "level" | "totalOrdersCompleted" | "collectedItems">
): boolean {
  const u = def.unlockCondition;
  if (u.type === "player_level") return prog.level >= u.value;
  if (u.type === "orders_completed") {
    if (typeof u.minLevel === "number" && prog.level < u.minLevel) return false;
    return prog.totalOrdersCompleted >= u.value;
  }
  return Boolean(prog.collectedItems[u.value]);
}

function collectPlacedGeneratorIds(grid: GridCell[]): Set<string> {
  const s = new Set<string>();
  for (const c of grid) {
    if (c.cellType === "generator" && c.item) s.add(c.item);
    if ((c.cellType === "box" || c.cellType === "hint_box") && c.boxIsGenerator && c.boxGeneratorId) {
      s.add(c.boxGeneratorId);
    }
  }
  return s;
}

function hintMatches(hint: GeneratorPlacementHint, c: number, r: number, w: number, h: number): boolean {
  const fx = c / Math.max(1, w - 1);
  const fy = r / Math.max(1, h - 1);
  switch (hint) {
    case "top":
      return r < h / 3;
    case "bottom":
      return r > (2 * h) / 3;
    case "left":
      return c < w / 3;
    case "right":
      return c > (2 * w) / 3;
    case "center":
    default:
      return fx >= 0.25 && fx <= 0.75 && fy >= 0.25 && fy <= 0.75;
  }
}

function candidateIndicesForChest(
  grid: GridCell[],
  width: number,
  height: number,
  hint: GeneratorPlacementHint
): number[] {
  const preferred: number[] = [];
  const fallback: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (c.cellType !== "box") continue;
    if (c.boxIsGenerator) continue;
    fallback.push(i);
    const col = i % width;
    const row = Math.floor(i / width);
    if (hintMatches(hint, col, row, width, height)) preferred.push(i);
  }
  preferred.sort((a, b) => a - b);
  fallback.sort((a, b) => a - b);
  return preferred.length > 0 ? preferred : fallback;
}

/**
 * Проверить условия и добавить новые сундуки-генераторы на поле.
 * Возвращает индексы новых сундуков для красивой анимации появления.
 */
export function syncGeneratorChestsForProgress(
  grid: GridCell[],
  width: number,
  height: number,
  prog: Pick<ProgressionState, "level" | "totalOrdersCompleted" | "collectedItems">
): { grid: GridCell[]; addedGeneratorIds: string[]; addedIndices: number[] } {
  const placed = collectPlacedGeneratorIds(grid);
  const next = grid.map((c) => ({ ...c }));
  const addedGeneratorIds: string[] = [];
  const addedIndices: number[] = [];

  for (const def of GENERATOR_PROGRESSION_LIST) {
    if (!ROOM_GENERATOR_DEFS[def.id]) continue;
    if (placed.has(def.id)) continue;
    if (!conditionMet(def, prog)) continue;

    const candidates = candidateIndicesForChest(next, width, height, def.placementHint);
    const pick = candidates[0];
    if (pick == null) continue;
    next[pick] = generatorBoxGridCell(def.id);
    placed.add(def.id);
    addedGeneratorIds.push(def.id);
    addedIndices.push(pick);
  }

  return { grid: next, addedGeneratorIds, addedIndices };
}
