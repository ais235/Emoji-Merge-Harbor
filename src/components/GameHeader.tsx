/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Одна шапка миниигры: те же классы/иконки, что на «Дом» (ds-card-peach, ds-stat-pill,
 * Zap / Star / Coins, ds-progress). Слева «Дом», по центру уровень/полоска/заказы, справа монеты и под ними энергия.
 */

import { useMemo } from "react";
import { Coins, Star, Zap } from "lucide-react";

export interface GameHeaderProps {
  energy: number;
  maxEnergy: number;
  /** 0, если энергия полная */
  msUntilNextEnergy: number;
  coins: number;
  playerLevel: number;
  playerXP: number;
  nextLevelXP: number;
  /** Всего выполнено заказов (накопительный счётчик прогрессии). */
  totalOrdersCompleted: number;
  onGoHome: () => void;
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
  totalOrdersCompleted,
  onGoHome,
}: GameHeaderProps) {
  const xpFill =
    nextLevelXP > 0 ? Math.min(100, (playerXP / nextLevelXP) * 100) : 0;
  const showRegen = energy < maxEnergy && msUntilNextEnergy > 0;
  const ordersLabel = `Заказов: ${totalOrdersCompleted}`;

  const regenTimer = useMemo(
    () => formatRegenCountdown(msUntilNextEnergy),
    [msUntilNextEnergy]
  );

  return (
    <div className="ds-card-peach mb-1.5 w-full flex-shrink-0 overflow-hidden">
      <div className="flex items-center gap-1 sm:gap-1.5">
        <div className="flex min-w-0 flex-1 items-center justify-start">
          <button type="button" onClick={onGoHome} className="ds-pill-home shrink-0">
            ← Дом
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-0.5">
          <div className="flex w-full max-w-[min(100%,200px)] flex-col items-center px-0.5">
            <div className="mb-0.5 flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
              <span className="text-[11px] font-medium" style={{ color: "var(--c-brown)" }}>
                Уровень {playerLevel}
              </span>
            </div>
            <div className="ds-progress w-full">
              <div
                className="ds-progress__fill ds-progress__fill--gold"
                style={{ width: `${xpFill}%` }}
              />
            </div>
          </div>

          <span
            className="text-center text-[11px] font-medium tabular-nums leading-tight"
            style={{ color: "var(--c-brown)" }}
          >
            {ordersLabel}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-1">
          <div id="header-coin-icon" className="ds-stat-pill inline-flex shrink-0 origin-center">
            <Coins className="h-3 w-3 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
            <span className="tabular-nums">{coins}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="ds-stat-pill">
              <Zap className="h-3 w-3 shrink-0" style={{ color: "var(--c-bluedark)" }} aria-hidden />
              <span className="tabular-nums">
                {energy}/{maxEnergy}
              </span>
            </div>
            <span
              className="min-h-[14px] font-mono text-[11px] font-semibold tabular-nums leading-none"
              style={{ color: "var(--c-bluedark)" }}
            >
              {showRegen ? regenTimer : "\u00a0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
