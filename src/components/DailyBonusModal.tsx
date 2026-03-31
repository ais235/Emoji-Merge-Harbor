/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

export const DAILY_REWARDS: Record<
  number,
  { coins: number; energy: number; subtitle?: string }
> = {
  1: { coins: 50, energy: 10 },
  2: { coins: 75, energy: 10 },
  3: { coins: 100, energy: 15 },
  4: { coins: 125, energy: 15 },
  5: { coins: 150, energy: 20 },
  6: { coins: 200, energy: 20 },
  7: { coins: 300, energy: 30, subtitle: "Отличная неделя! 🎉" },
};

export interface DailyBonusModalProps {
  day: number;
  canClaim: boolean;
  onClaim: (coins: number, energy: number) => void;
  onClose: () => void;
}

export default function DailyBonusModal({
  day,
  canClaim,
  onClaim,
  onClose,
}: DailyBonusModalProps) {
  const safeDay = Math.min(7, Math.max(1, day));
  const reward = DAILY_REWARDS[safeDay];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-sm rounded-[1.5rem] bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">
          Ежедневный бонус
        </h2>
        <p className="mt-1 text-sm font-bold text-gray-500">
          День {safeDay} из 7
        </p>

        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const past = d < safeDay;
            const current = d === safeDay;
            return (
              <div
                key={d}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${
                  past
                    ? "bg-blue-500 text-white"
                    : current
                      ? "bg-blue-100 ring-2 ring-blue-500 text-blue-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {d}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl bg-amber-50 py-4">
          <p className="text-xs font-bold uppercase text-amber-800">Сегодня</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-lg font-black text-gray-900">
            <span>
              🍪 {reward.coins}
            </span>
            <span>
              ⚡ {reward.energy}
            </span>
          </div>
          {reward.subtitle ? (
            <p className="mt-2 text-sm font-bold text-amber-900">{reward.subtitle}</p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canClaim}
          onClick={() => {
            if (canClaim) onClaim(reward.coins, reward.energy);
          }}
          className={`mt-6 w-full rounded-xl py-3 text-sm font-bold ${
            canClaim
              ? "bg-blue-500 text-white shadow-md active:bg-blue-600"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
        >
          {canClaim ? "Забрать!" : "Уже получено"}
        </button>
      </div>
    </div>
  );
}
