/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import {
  ENERGY_COIN_PACK_AMOUNT,
  ENERGY_COIN_PACK_COST,
} from "../gameBalance";
import type { ActiveZone } from "../types";
import { ZONE_NAMES } from "../types";

export interface GameHeaderProps {
  zone: ActiveZone;
  energy: number;
  maxEnergy: number;
  /** 0, если энергия полная */
  msUntilNextEnergy: number;
  coins: number;
  playerLevel: number;
  playerXP: number;
  nextLevelXP: number;
  /** Выполнено заказов миниигры в этой комнате (квота) */
  ordersCompleted: number;
  maxOrders: number;
  onGoHome: () => void;
  onBuyEnergy: () => void;
  canAffordEnergy: boolean;
  soundOn?: boolean;
  onToggleSound?: () => void;
}

export function GameHeader({
  zone,
  energy,
  maxEnergy,
  msUntilNextEnergy,
  coins,
  playerLevel,
  playerXP,
  nextLevelXP,
  ordersCompleted,
  maxOrders,
  onGoHome,
  onBuyEnergy,
  canAffordEnergy,
  soundOn = true,
  onToggleSound,
}: GameHeaderProps) {
  const roomName = ZONE_NAMES[zone] ?? "Комната";
  const minutesLeft = useMemo(
    () => (msUntilNextEnergy > 0 ? Math.max(1, Math.ceil(msUntilNextEnergy / 60_000)) : 0),
    [msUntilNextEnergy]
  );
  const xpFill =
    nextLevelXP > 0 ? Math.min(100, (playerXP / nextLevelXP) * 100) : 0;
  const showRegen = energy < maxEnergy && msUntilNextEnergy > 0;
  const buyDisabled = !canAffordEnergy || energy >= maxEnergy;
  const ordersLabel =
    maxOrders > 0 ? `Заказов: ${ordersCompleted}/${maxOrders}` : "Заказов: —";

  return (
    <div
      className="mb-1.5 w-full flex-shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{
        borderColor: "#E8E0D0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Строка 1: Дом | зона | звук + монеты */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ background: "#FFF8EE", borderColor: "#F0E8D8" }}
      >
        <button
          type="button"
          onClick={onGoHome}
          className="flex shrink-0 items-center gap-1 rounded-lg border-0 px-2 py-1 text-[11px] font-semibold"
          style={{ background: "#F0E8D8", color: "#8B6914" }}
        >
          <span aria-hidden>🏠</span> Дом
        </button>
        <div
          className="min-w-0 flex-1 text-center text-[13px] font-bold leading-tight"
          style={{ color: "#3D2B00" }}
        >
          {roomName}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleSound ? (
            <button
              type="button"
              onClick={onToggleSound}
              className="rounded-md p-1 text-[14px] leading-none opacity-90 hover:opacity-100"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
              title={soundOn ? "Выключить звук" : "Включить звук"}
              aria-label={soundOn ? "Выключить звук" : "Включить звук"}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
          ) : null}
          <div
            id="header-coin-icon"
            className="inline-flex origin-center items-center gap-1.5 rounded-full border px-2.5 py-1 pr-2.5"
            style={{
              background: "#FFFBEE",
              borderColor: "#F5C518",
              borderWidth: "1.5px",
            }}
          >
            <div
              className="h-5 w-5 shrink-0 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 35%, #FFE566, #F5A623)",
                border: "2px solid #D4810A",
              }}
              aria-hidden
            />
            <span className="text-[12px] font-bold tabular-nums" style={{ color: "#7A5000" }}>
              {coins}
            </span>
          </div>
        </div>
      </div>

      {/* Строка 2: энергия + покупка, вправо */}
      <div className="flex min-h-[48px] items-center justify-end gap-2 px-3 py-2">
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 pl-1.5"
          style={{
            background: "#EEF6FF",
            borderColor: "#B3D4F5",
            borderWidth: "1.5px",
          }}
        >
          <div
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px]"
            style={{
              background: "linear-gradient(135deg, #64B5F6, #1565C0)",
            }}
            aria-hidden
          >
            ⚡
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-bold tabular-nums" style={{ color: "#1565C0" }}>
              {energy} / {maxEnergy}
            </span>
            <span
              className="min-h-[12px] text-[9px]"
              style={{ color: "#78A9D4", opacity: showRegen ? 1 : 0 }}
              aria-hidden={!showRegen}
            >
              {showRegen ? `+1 через ${minutesLeft}м` : "\u00a0"}
            </span>
          </div>
        </div>

        <div className="flex min-h-[34px] min-w-0 items-center justify-end">
          <button
            type="button"
            onClick={onBuyEnergy}
            disabled={buyDisabled}
            tabIndex={energy >= maxEnergy ? -1 : 0}
            className="inline-flex max-w-[10rem] shrink-0 items-center gap-1 rounded-2xl border px-2.5 py-1 text-[10px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: "#FFF3CD",
              borderColor: "#F5C518",
              borderWidth: "1.5px",
              color: "#7A5000",
              visibility: energy < maxEnergy ? "visible" : "hidden",
            }}
            aria-hidden={energy >= maxEnergy}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                background: "#F5C518",
                border: "1.5px solid #D4A017",
              }}
              aria-hidden
            />
            <span className="whitespace-nowrap">
              {ENERGY_COIN_PACK_COST} → +{ENERGY_COIN_PACK_AMOUNT}⚡
            </span>
          </button>
        </div>
      </div>

      {/* Строка 3: уровень, XP, счётчик заказов */}
      <div className="flex items-center gap-2 px-3 pb-2.5">
        <div
          className="shrink-0 rounded-[10px] border px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: "#FFF3CD",
            borderColor: "#F5C518",
            borderWidth: "1.5px",
            color: "#7A5000",
          }}
        >
          ⭐ Ур.{playerLevel}
        </div>
        <div
          className="min-w-0 flex-1 overflow-hidden rounded-[10px]"
          style={{ height: 5, background: "#EEE" }}
        >
          <div
            className="h-full rounded-[10px] transition-[width] duration-300 ease-out"
            style={{
              width: `${xpFill}%`,
              background: "linear-gradient(90deg, #FFD700, #FF9800)",
            }}
          />
        </div>
        <div className="shrink-0 text-[10px] tabular-nums" style={{ color: "#999" }}>
          {ordersLabel}
        </div>
      </div>
    </div>
  );
}
