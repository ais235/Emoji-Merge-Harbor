/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Coins } from "lucide-react";

export interface GameHeaderProps {
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
  soundOn?: boolean;
  onToggleSound?: () => void;
}

export function GameHeader({
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
  soundOn = true,
  onToggleSound,
}: GameHeaderProps) {
  const minutesLeft = useMemo(
    () => (msUntilNextEnergy > 0 ? Math.max(1, Math.ceil(msUntilNextEnergy / 60_000)) : 0),
    [msUntilNextEnergy]
  );
  const xpFill =
    nextLevelXP > 0 ? Math.min(100, (playerXP / nextLevelXP) * 100) : 0;
  const showRegen = energy < maxEnergy && msUntilNextEnergy > 0;
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
      {/* Одна строка: Дом | энергия | звук | монеты (как на экране «Дом») */}
      <div
        className="flex min-h-[44px] items-center gap-2 px-3 py-2"
        style={{ background: "#FFF8EE", borderBottom: "1px solid #F0E8D8" }}
      >
        <button
          type="button"
          onClick={onGoHome}
          className="flex shrink-0 items-center gap-1 rounded-lg border-0 px-2 py-1 text-[11px] font-semibold"
          style={{ background: "#F0E8D8", color: "#8B6914" }}
        >
          <span aria-hidden>🏠</span> Дом
        </button>

        <div className="flex min-w-0 flex-1 justify-center px-1">
          <div
            className="flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 pl-1.5"
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
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[12px] font-bold tabular-nums" style={{ color: "#1565C0" }}>
                {energy} / {maxEnergy}
              </span>
              <span
                className="min-h-[11px] text-[9px]"
                style={{ color: "#78A9D4", opacity: showRegen ? 1 : 0 }}
                aria-hidden={!showRegen}
              >
                {showRegen ? `+1 через ${minutesLeft}м` : "\u00a0"}
              </span>
            </div>
          </div>
        </div>

        {onToggleSound ? (
          <button
            type="button"
            onClick={onToggleSound}
            className="shrink-0 rounded-md p-1 text-[14px] leading-none opacity-90 hover:opacity-100"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
            title={soundOn ? "Выключить звук" : "Включить звук"}
            aria-label={soundOn ? "Выключить звук" : "Включить звук"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}

        <div
          id="header-coin-icon"
          className="ds-stat-pill inline-flex shrink-0 origin-center"
        >
          <Coins className="h-3 w-3 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
          <span className="tabular-nums">{coins}</span>
        </div>
      </div>

      {/* Уровень, XP, счётчик заказов */}
      <div className="flex items-center gap-2 px-3 py-2.5">
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
