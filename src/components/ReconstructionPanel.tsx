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
      <div className="ds-card mb-3 w-full border-[var(--c-green)]" style={{ borderWidth: "1.5px" }}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[9px] font-medium" style={{ color: "var(--c-rosedark)" }}>
            Реконструкция
          </span>
          <span className="ds-badge" style={{ background: "var(--c-green)" }}>
            Готово
          </span>
        </div>
        <div className="text-center text-[12px] font-medium" style={{ color: "var(--c-greendark)" }}>
          Все этапы завершены
        </div>
        <div className="ds-progress mt-2 w-full">
          <motion.div
            className="ds-progress__fill ds-progress__fill--green"
            initial={false}
            animate={{ width: "100%" }}
          />
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
    <div className="ds-card mb-3 w-full">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-medium" style={{ color: "var(--c-rosedark)" }}>
          Реконструкция
        </span>
        <span className="text-[9px] font-medium tabular-nums" style={{ color: "var(--c-brown)" }}>
          Этап {doneStages + 1}/{total}
        </span>
      </div>
      <div className="mb-1 text-[12px] font-medium" style={{ color: "var(--c-browndark)" }}>
        {stage.title}
      </div>
      <p className="mb-2 text-[10px] font-medium leading-snug" style={{ color: "var(--c-brown)" }}>
        {stage.description}
      </p>

      {orderProg != null ? (
        <div className="mb-1 text-[11px] font-medium tabular-nums" style={{ color: "var(--c-browndark)" }}>
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
                className="flex items-center gap-1 text-[10px] font-medium"
                style={{ color: "var(--c-browndark)" }}
              >
                <span aria-hidden>{def?.emoji ?? "•"}</span>
                <span>
                  {def?.name ?? n.itemId}: {done}/{n.count}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="ds-progress w-full">
        <motion.div
          className="ds-progress__fill ds-progress__fill--rose"
          initial={false}
          animate={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[9px] font-medium" style={{ color: "var(--c-muted)" }}>
        Награда: 🍪 {stage.rewardCoins} · XP {stage.rewardXp}
        {stage.unlockZones?.length
          ? ` · откроется: ${stage.unlockZones.map((z) => UNLOCK_ZONE_LABEL[z] ?? z).join(", ")}`
          : null}
      </div>
    </div>
  );
}
