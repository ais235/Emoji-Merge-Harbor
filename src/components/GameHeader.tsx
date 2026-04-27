/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Одна шапка миниигры: те же классы/иконки, что на «Дом» (ds-card-peach, ds-stat-pill,
 * Zap / Star / Coins, ds-progress). Таймер до +1 энергии — обратный отсчёт M:SS.
 */

import React, { useMemo } from "react";
import { Coins, Star, Volume2, VolumeX, Zap } from "lucide-react";

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

function formatRegenCountdown(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const xpFill =
    nextLevelXP > 0 ? Math.min(100, (playerXP / nextLevelXP) * 100) : 0;
  const showRegen = energy < maxEnergy && msUntilNextEnergy > 0;
  const ordersLabel =
    maxOrders > 0 ? `Заказов: ${ordersCompleted}/${maxOrders}` : "Заказов: —";

  const regenTimer = useMemo(
    () => formatRegenCountdown(msUntilNextEnergy),
    [msUntilNextEnergy]
  );

  return (
    <div className="ds-card-peach mb-1.5 w-full flex-shrink-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
          <button type="button" onClick={onGoHome} className="ds-pill-home shrink-0">
            ← Дом
          </button>

          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <div className="ds-stat-pill">
              <Zap className="h-3 w-3 shrink-0" style={{ color: "var(--c-bluedark)" }} aria-hidden />
              <span className="tabular-nums">
                {energy}/{maxEnergy}
              </span>
            </div>
            <span
              className="min-h-[14px] font-mono text-[10px] font-semibold tabular-nums leading-none"
              style={{ color: "var(--c-bluedark)" }}
            >
              {showRegen ? regenTimer : "\u00a0"}
            </span>
          </div>

          <div className="flex min-h-[44px] min-w-[88px] flex-1 flex-col items-center justify-center px-1">
            <div className="mb-0.5 flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
              <span className="text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
                Уровень {playerLevel}
              </span>
            </div>
            <div className="ds-progress w-full max-w-[160px]">
              <div
                className="ds-progress__fill ds-progress__fill--gold"
                style={{ width: `${xpFill}%` }}
              />
            </div>
          </div>

          <div id="header-coin-icon" className="ds-stat-pill inline-flex shrink-0 origin-center">
            <Coins className="h-3 w-3 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
            <span className="tabular-nums">{coins}</span>
          </div>

          <span
            className="max-w-[9rem] shrink-0 text-[10px] font-medium tabular-nums leading-tight sm:max-w-none"
            style={{ color: "var(--c-brown)" }}
          >
            {ordersLabel}
          </span>
        </div>

        {onToggleSound ? (
          <button
            type="button"
            onClick={onToggleSound}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border bg-[var(--c-cream)] p-2"
            style={{ borderColor: "var(--c-peach2)" }}
            title={soundOn ? "Выключить звук" : "Включить звук"}
            aria-label={soundOn ? "Выключить звук" : "Включить звук"}
          >
            {soundOn ? (
              <Volume2 className="h-[18px] w-[18px]" style={{ color: "var(--c-browndark)" }} aria-hidden />
            ) : (
              <VolumeX className="h-[18px] w-[18px]" style={{ color: "var(--c-browndark)" }} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
