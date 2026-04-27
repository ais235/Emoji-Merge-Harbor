/**
 * Лимит заказов миниигры на комнату: зависит от числа визуальных апгрейдов (уровень ремонта).
 */

import { UPGRADES } from "../progressionData";
import {
  isActiveZone,
  progressZoneId,
  type ActiveZone,
  type ProgressionState,
  type UpgradeZoneId,
} from "../types";

/** Зона апгрейда → зона поля / playZone. */
export function upgradeZoneToActiveZone(zone: UpgradeZoneId): ActiveZone | null {
  if (zone === "meta") return null;
  if (zone === "secret_room") return "secret";
  return isActiveZone(zone) ? zone : null;
}

/** Сколько визуальных улучшений куплено в комнате (уровень «ремонта» для лимита заказов). */
export function roomVisualUpgradeCountForZone(zone: ActiveZone, purchasedUpgradeIds: string[]): number {
  const zProg = progressZoneId(zone);
  let n = 0;
  for (const id of purchasedUpgradeIds) {
    const u = UPGRADES.find((x) => x.id === id);
    if (u && u.effectType === "visual" && u.zone === zProg) n += 1;
  }
  return n;
}

/** Макс. заказов миниигры при данном уровне ремонта: (repairLevel + 1) * 5. */
export function maxMinigameOrdersForRepairLevel(repairLevel: number): number {
  return (repairLevel + 1) * 5;
}

export function minigameOrdersCompletedInRoom(prog: ProgressionState, zone: ActiveZone): number {
  const m = prog.minigameOrdersAtRoomRepair;
  const v = m && typeof m === "object" && !Array.isArray(m) ? m[zone] : undefined;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function maxMinigameOrdersForZone(zone: ActiveZone, purchasedUpgradeIds: string[]): number {
  const repair = roomVisualUpgradeCountForZone(zone, purchasedUpgradeIds);
  return maxMinigameOrdersForRepairLevel(repair);
}

export function canGenerateMinigameOrder(
  prog: Pick<ProgressionState, "minigameOrdersAtRoomRepair" | "purchasedUpgrades">,
  zone: ActiveZone
): boolean {
  const completed = minigameOrdersCompletedInRoom(prog as ProgressionState, zone);
  const maxO = maxMinigameOrdersForZone(zone, prog.purchasedUpgrades);
  return completed < maxO;
}

export function incrementMinigameOrderComplete(prog: ProgressionState, zone: ActiveZone): ProgressionState {
  const prev = minigameOrdersCompletedInRoom(prog, zone);
  return {
    ...prog,
    minigameOrdersAtRoomRepair: { ...(prog.minigameOrdersAtRoomRepair ?? {}), [zone]: prev + 1 },
  };
}

export function resetMinigameOrdersForRoom(prog: ProgressionState, zone: ActiveZone): ProgressionState {
  return {
    ...prog,
    minigameOrdersAtRoomRepair: { ...(prog.minigameOrdersAtRoomRepair ?? {}), [zone]: 0 },
  };
}

/** Самый дешёвый ещё не купленный визуальный апгрейд в комнате (следующий «шаг ремонта»). */
export function nextVisualRepairOffer(
  zone: ActiveZone,
  purchasedUpgradeIds: string[]
): { id: string; cost: number; name: string } | null {
  const zProg = progressZoneId(zone);
  const candidates = UPGRADES.filter(
    (u) => u.effectType === "visual" && u.zone === zProg && !purchasedUpgradeIds.includes(u.id)
  ).sort((a, b) => a.cost - b.cost);
  const first = candidates[0];
  return first ? { id: first.id, cost: first.cost, name: first.name } : null;
}
