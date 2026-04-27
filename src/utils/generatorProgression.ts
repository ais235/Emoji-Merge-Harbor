/**
 * Разблокировка генераторов по прогрессу и пометка клеток тумана `pendingGenerator`.
 */

import type { GridCell, ProgressionState } from "../types";
import { ROOM_GENERATOR_DEFS } from "../roomMergeCatalog";
import { chainsFromGridGenerators } from "../types";

export type GeneratorPlacementHint = "center" | "top" | "bottom" | "left" | "right";

export interface GeneratorProgressDef {
  id: string;
  spawnsChainId: string;
  unlockCondition:
    | { type: "player_level"; value: number }
    | { type: "orders_completed"; value: number }
    | { type: "item_collected"; value: string };
  placementHint: GeneratorPlacementHint;
}

/** Стартовый генератор зала не входит — остальные появляются по прогрессу. */
export const GENERATOR_PROGRESSION_LIST: GeneratorProgressDef[] = (
  [
    ["gen_kitchen", "kitchen_meal", { type: "player_level" as const, value: 2 }, "top" as const],
    ["gen_bedroom", "bedroom_cozy", { type: "player_level" as const, value: 3 }, "left" as const],
    ["gen_bathroom", "bathroom_fresh", { type: "orders_completed" as const, value: 8 }, "right" as const],
    ["gen_terrace", "terrace_plants", { type: "player_level" as const, value: 5 }, "top" as const],
    ["gen_office", "office_work", { type: "orders_completed" as const, value: 25 }, "center" as const],
    ["gen_lounge", "lounge_drinks", { type: "player_level" as const, value: 7 }, "bottom" as const],
    ["gen_secret", "secret_mystic", { type: "player_level" as const, value: 10 }, "center" as const],
    ["gen_garden", "garden_harvest", { type: "orders_completed" as const, value: 40 }, "bottom" as const],
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
  if (u.type === "orders_completed") return prog.totalOrdersCompleted >= u.value;
  return Boolean(prog.collectedItems[u.value]);
}

function collectPlacedGeneratorIds(grid: GridCell[]): Set<string> {
  const s = new Set<string>();
  for (const c of grid) {
    if (c.cellType === "generator" && c.item) s.add(c.item);
    if (c.cellType === "fog" && c.pendingGenerator) s.add(c.pendingGenerator);
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

/** Случайная fog-клетка в зоне подсказки с меткой pendingGenerator. */
export function placeGeneratorInFog(
  grid: GridCell[],
  width: number,
  height: number,
  generatorId: string,
  hint: GeneratorPlacementHint
): GridCell[] {
  const pool: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].cellType !== "fog" || grid[i].pendingGenerator) continue;
    const c = i % width;
    const r = Math.floor(i / width);
    if (!hintMatches(hint, c, r, width, height)) continue;
    pool.push(i);
  }
  const wide = pool.length > 0 ? pool : grid.map((c, i) => (c.cellType === "fog" && !c.pendingGenerator ? i : -1)).filter((i) => i >= 0);
  if (wide.length === 0) return grid;
  const pick = wide[Math.floor(Math.random() * wide.length)]!;
  const next = grid.map((cell) => ({ ...cell }));
  next[pick] = { ...next[pick], pendingGenerator: generatorId };
  return next;
}

/** Проверить разблокировки и пометить туман (без UI). */
export function checkGeneratorUnlocks(
  grid: GridCell[],
  width: number,
  height: number,
  prog: Pick<ProgressionState, "level" | "totalOrdersCompleted" | "collectedItems">
): { grid: GridCell[]; newlyUnlocked: string[] } {
  const placed = collectPlacedGeneratorIds(grid);
  let next = grid.map((c) => ({ ...c }));
  const newlyUnlocked: string[] = [];

  for (const def of GENERATOR_PROGRESSION_LIST) {
    if (!ROOM_GENERATOR_DEFS[def.id]) continue;
    if (placed.has(def.id)) continue;
    if (!conditionMet(def, prog)) continue;
    const before = next.some((c) => c.pendingGenerator === def.id);
    next = placeGeneratorInFog(next, width, height, def.id, def.placementHint);
    const after = next.some((c) => c.pendingGenerator === def.id);
    if (after && !before) {
      newlyUnlocked.push(def.id);
      placed.add(def.id);
    }
  }

  return { grid: next, newlyUnlocked };
}

export function getActiveChainIds(grid: GridCell[]): string[] {
  const chains = chainsFromGridGenerators(grid);
  const ids = chains.map((c) => c.id);
  return [...new Set(ids)];
}
