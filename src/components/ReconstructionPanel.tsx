/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import type { ReconstructionState } from "../types";
import { ALL_ITEMS } from "../types";
import {
  getCurrentReconstructionStage,
  isReconstructionFullyComplete,
  reconstructionOrdersProgress,
  RECONSTRUCTION_STAGES,
  reconstructionItemRemaining,
} from "../reconstruction";

const UNLOCK_ZONE_LABEL: Record<string, string> = {
  hall: "Зал",
  kitchen: "Кухня",
  terrace: "Терраса",
  secret_room: "Тайная комната",
};

export interface ReconstructionPanelProps {
  reconstruction: ReconstructionState;
}

export default function ReconstructionPanel({ reconstruction }: ReconstructionPanelProps) {
  const total = RECONSTRUCTION_STAGES.length;
  const doneStages = Math.min(reconstruction.stageIndex, total);

  if (isReconstructionFullyComplete(reconstruction)) {
    return (
      <div className="mb-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
        <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
          Реконструкция кафе
        </div>
        <div className="text-center text-sm font-bold text-emerald-900">Все этапы завершены ✨</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-200/80">
          <motion.div className="h-full bg-emerald-500" initial={false} animate={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  const stage = getCurrentReconstructionStage(reconstruction);
  if (!stage) return null;

  const orderProg = reconstructionOrdersProgress(reconstruction, stage);
  const pct =
    orderProg != null
      ? Math.min(100, (orderProg.current / orderProg.target) * 100)
      : stage.requirement.type === "items"
        ? Math.min(
            100,
            (stage.requirement.needs.reduce((acc, n) => {
              const rem = reconstructionItemRemaining(reconstruction, stage, n.itemId);
              return acc + (n.count - rem) / n.count;
            }, 0) /
              stage.requirement.needs.length) *
              100
          )
        : 0;

  return (
    <div className="mb-3 w-full rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-violet-800">
          Реконструкция
        </span>
        <span className="text-[9px] font-bold tabular-nums text-violet-600">
          этап {doneStages + 1}/{total}
        </span>
      </div>
      <div className="mb-1 text-sm font-bold text-gray-900">{stage.title}</div>
      <p className="mb-2 text-[10px] leading-snug text-gray-500">{stage.description}</p>

      {orderProg != null ? (
        <div className="mb-1 text-[11px] font-mono font-bold tabular-nums text-gray-700">
          Заказы: {orderProg.current}/{orderProg.target}
        </div>
      ) : stage.requirement.type === "items" ? (
        <ul className="mb-1 space-y-0.5">
          {stage.requirement.needs.map((n) => {
            const rem = reconstructionItemRemaining(reconstruction, stage, n.itemId);
            const done = n.count - rem;
            const def = ALL_ITEMS[n.itemId];
            return (
              <li
                key={n.itemId}
                className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-700"
              >
                <span aria-hidden>{def?.emoji ?? "•"}</span>
                <span>
                  {n.itemId}: {done}/{n.count}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
        <motion.div
          className="h-full bg-violet-500"
          initial={false}
          animate={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[9px] text-gray-400">
        Награда: 🍪 {stage.rewardCoins} · XP {stage.rewardXp}
        {stage.unlockZones?.length
          ? ` · откроется: ${stage.unlockZones.map((z) => UNLOCK_ZONE_LABEL[z] ?? z).join(", ")}`
          : null}
      </div>
    </div>
  );
}
