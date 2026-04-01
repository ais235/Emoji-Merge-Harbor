import type { GridCell, ItemId, ReconstructionState } from "./types";
import { isObstacleCellState } from "./types";

export type ReconstructionRequirement =
  | { type: "orders"; count: number }
  | { type: "items"; needs: { itemId: ItemId; count: number }[] };

export interface ReconstructionStage {
  id: string;
  title: string;
  description: string;
  requirement: ReconstructionRequirement;
  rewardCoins: number;
  rewardXp: number;
  /** Коды зон как в `ProgressionState.unlockedZones` (kitchen, secret_room, …). */
  unlockZones?: string[];
}

export const RECONSTRUCTION_STAGES: ReconstructionStage[] = [
  {
    id: "restore_kitchen",
    title: "Восстановить кухню",
    description: "Выполняйте заказы — так накапливается прогресс ремонта.",
    requirement: { type: "orders", count: 6 },
    rewardCoins: 200,
    rewardXp: 80,
    unlockZones: ["kitchen"],
  },
  {
    id: "open_secret_room",
    title: "Открыть тайную комнату",
    description: "Передайте предметы с поля, чтобы завершить отделку.",
    requirement: {
      type: "items",
      needs: [
        { itemId: "f4", count: 2 },
        { itemId: "s3", count: 1 },
      ],
    },
    rewardCoins: 450,
    rewardXp: 150,
    unlockZones: ["secret_room"],
  },
];

export function defaultReconstructionState(): ReconstructionState {
  return { stageIndex: 0, ordersForStage: 0, itemsDelivered: {} };
}

export function normalizeReconstructionState(raw: unknown): ReconstructionState {
  const d = defaultReconstructionState();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const stageIndex = typeof o.stageIndex === "number" && o.stageIndex >= 0 ? Math.floor(o.stageIndex) : 0;
  const ordersForStage =
    typeof o.ordersForStage === "number" && o.ordersForStage >= 0 ? Math.floor(o.ordersForStage) : 0;
  let itemsDelivered: Partial<Record<ItemId, number>> = {};
  if (o.itemsDelivered && typeof o.itemsDelivered === "object" && !Array.isArray(o.itemsDelivered)) {
    for (const [k, v] of Object.entries(o.itemsDelivered as Record<string, unknown>)) {
      if (typeof v === "number" && v >= 0) itemsDelivered[k] = Math.floor(v);
    }
  }
  const maxIdx = RECONSTRUCTION_STAGES.length;
  return {
    stageIndex: Math.min(stageIndex, maxIdx),
    ordersForStage,
    itemsDelivered,
  };
}

export function getCurrentReconstructionStage(
  recon: ReconstructionState
): ReconstructionStage | null {
  return RECONSTRUCTION_STAGES[recon.stageIndex] ?? null;
}

export function reconstructionItemRemaining(
  recon: ReconstructionState,
  stage: ReconstructionStage,
  itemId: ItemId
): number {
  if (stage.requirement.type !== "items") return 0;
  const need = stage.requirement.needs.find((n) => n.itemId === itemId);
  if (!need) return 0;
  const done = recon.itemsDelivered[itemId] ?? 0;
  return Math.max(0, need.count - done);
}

export function reconstructionItemsComplete(recon: ReconstructionState, stage: ReconstructionStage): boolean {
  if (stage.requirement.type !== "items") return false;
  return stage.requirement.needs.every((n) => (recon.itemsDelivered[n.itemId] ?? 0) >= n.count);
}

export function reconstructionOrdersProgress(recon: ReconstructionState, stage: ReconstructionStage): {
  current: number;
  target: number;
} | null {
  if (stage.requirement.type !== "orders") return null;
  return { current: recon.ordersForStage, target: stage.requirement.count };
}

/**
 * После полного выполнения игрового заказа: +1 к счётчику этапа «orders», при достижении лимита — этап завершён.
 */
export function tickReconstructionAfterOrderComplete(recon: ReconstructionState): {
  reconstruction: ReconstructionState;
  completed: ReconstructionStage | null;
} {
  const stage = RECONSTRUCTION_STAGES[recon.stageIndex];
  if (!stage || stage.requirement.type !== "orders") {
    return { reconstruction: recon, completed: null };
  }
  const nextCount = recon.ordersForStage + 1;
  if (nextCount < stage.requirement.count) {
    return { reconstruction: { ...recon, ordersForStage: nextCount }, completed: null };
  }
  return {
    reconstruction: {
      stageIndex: recon.stageIndex + 1,
      ordersForStage: 0,
      itemsDelivered: {},
    },
    completed: stage,
  };
}

/**
 * Сдать один подходящий предмет с поля в текущий этап «items». Возвращает null, если сдать нечего.
 */
export function tryDeliverReconstructionItem(
  recon: ReconstructionState,
  grid: GridCell[]
): {
  reconstruction: ReconstructionState;
  grid: GridCell[];
  cellIndex: number;
} | null {
  const stage = RECONSTRUCTION_STAGES[recon.stageIndex];
  if (!stage || stage.requirement.type !== "items") return null;

  for (const need of stage.requirement.needs) {
    const rem = reconstructionItemRemaining(recon, stage, need.itemId);
    if (rem <= 0) continue;
    const idx = grid.findIndex((c) => c.item === need.itemId && !isObstacleCellState(c.cellState));
    if (idx < 0) continue;
    const newGrid = [...grid];
    newGrid[idx] = { ...newGrid[idx], item: null };
    const prev = recon.itemsDelivered[need.itemId] ?? 0;
    return {
      reconstruction: {
        ...recon,
        itemsDelivered: { ...recon.itemsDelivered, [need.itemId]: prev + 1 },
      },
      grid: newGrid,
      cellIndex: idx,
    };
  }
  return null;
}

/**
 * Если после сдачи предмета этап «items» закрыт — вернуть завершённый этап и состояние следующего.
 */
export function tryCompleteReconstructionItemsStage(recon: ReconstructionState): {
  reconstruction: ReconstructionState;
  completed: ReconstructionStage | null;
} {
  const stage = RECONSTRUCTION_STAGES[recon.stageIndex];
  if (!stage || stage.requirement.type !== "items") return { reconstruction: recon, completed: null };
  if (!reconstructionItemsComplete(recon, stage)) return { reconstruction: recon, completed: null };
  return {
    reconstruction: {
      stageIndex: recon.stageIndex + 1,
      ordersForStage: 0,
      itemsDelivered: {},
    },
    completed: stage,
  };
}

export function isReconstructionFullyComplete(recon: ReconstructionState): boolean {
  return recon.stageIndex >= RECONSTRUCTION_STAGES.length;
}

export function canDeliverReconstructionItem(recon: ReconstructionState, grid: GridCell[]): boolean {
  const stage = RECONSTRUCTION_STAGES[recon.stageIndex];
  if (!stage || stage.requirement.type !== "items") return false;
  for (const need of stage.requirement.needs) {
    if (reconstructionItemRemaining(recon, stage, need.itemId) <= 0) continue;
    if (grid.some((c) => c.item === need.itemId && !isObstacleCellState(c.cellState))) return true;
  }
  return false;
}
