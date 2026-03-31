/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Zap, Coins, Star } from "lucide-react";
import { motion } from "motion/react";
import type { ActiveZone } from "../types";
import { progressZoneId } from "../types";

const ZONES: {
  id: ActiveZone;
  emoji: string;
  name: string;
  unlockLevel: number;
}[] = [
  { id: "hall", emoji: "☕", name: "Основной зал", unlockLevel: 1 },
  { id: "kitchen", emoji: "🍳", name: "Кухня", unlockLevel: 5 },
  { id: "terrace", emoji: "🌿", name: "Терраса", unlockLevel: 10 },
  { id: "secret", emoji: "🔮", name: "Тайная комната", unlockLevel: 15 },
];

export interface HomeScreenProps {
  energy: number;
  maxEnergy: number;
  level: number;
  coins: number;
  xpProgressPercent: number;
  unlockedZones: string[];
  onNavigateRoom: (zone: ActiveZone) => void;
  onPlay: () => void;
  dailyQuestCompleted: number;
  dailyQuestTotal: number;
  dailyUnclaimedCount: number;
  onOpenDaily: () => void;
  /** Полный сброс (dev): clear storage + reload */
  onResetGame?: () => void;
}

export default function HomeScreen({
  energy,
  maxEnergy,
  level,
  coins,
  xpProgressPercent,
  unlockedZones,
  onNavigateRoom,
  onPlay,
  dailyQuestCompleted,
  dailyQuestTotal,
  dailyUnclaimedCount,
  onOpenDaily,
  onResetGame,
}: HomeScreenProps) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[360px] flex-col overflow-hidden bg-[#F8F9FA] p-2 font-sans select-none">
      {/* Шапка */}
      <div className="mb-2 w-full flex-shrink-0 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-1">
            <Zap className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
            <span className="text-xs font-bold text-blue-700">
              {energy}/{maxEnergy}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center px-2">
            <div className="mb-0.5 flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                Уровень {level}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <motion.div
                className="h-full bg-yellow-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(xpProgressPercent, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-yellow-100 bg-yellow-50 px-2 py-1">
            <Coins className="h-3.5 w-3.5 fill-yellow-600 text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">{coins}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex flex-1 flex-col px-0.5">
        <h1 className="mb-0.5 text-center text-lg font-black text-gray-900">
          Кафе Лены ☕
        </h1>

        <button
          type="button"
          onClick={onOpenDaily}
          className="relative mb-3 w-full rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm active:bg-gray-50"
        >
          {dailyUnclaimedCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
              {dailyUnclaimedCount}
            </span>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-2xl" aria-hidden>
                📋
              </span>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  Ежедневные задания
                </div>
                <div className="text-[11px] text-gray-500">
                  Выполнено: {dailyQuestCompleted} из {dailyQuestTotal}
                </div>
              </div>
            </div>
            <span className="text-lg text-gray-400">→</span>
          </div>
        </button>

        <p className="mb-3 text-center text-[11px] text-gray-500">
          Выбери комнату для обустройства
        </p>

        <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pb-2">
          {ZONES.map((zone) => {
            const key = progressZoneId(zone.id);
            const isOpen = unlockedZones.includes(key);
            return (
              <div
                key={zone.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <span
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center text-[48px] leading-none"
                  aria-hidden
                >
                  {zone.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900">{zone.name}</div>
                  {isOpen ? (
                    <div className="text-[11px] text-green-600">Открыта</div>
                  ) : (
                    <div className="text-[11px] text-gray-400">
                      🔒 Откроется на уровне {zone.unlockLevel}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!isOpen}
                  onClick={() => onNavigateRoom(zone.id)}
                  className={`flex-shrink-0 rounded-lg border-2 px-3 py-2 text-[11px] font-bold uppercase ${
                    isOpen
                      ? "border-blue-500 bg-white text-blue-600 active:bg-blue-50"
                      : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
                  }`}
                >
                  Обустроить
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 pt-1 pb-[env(safe-area-inset-bottom,0px)]">
        {onResetGame ? (
          <button type="button" onClick={onResetGame}>
            Reset Game
          </button>
        ) : null}
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onPlay}
          className="flex w-full flex-row items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-base font-bold text-white shadow-md shadow-blue-100 active:bg-blue-600"
        >
          <span className="text-xl leading-none" aria-hidden>
            ⚡
          </span>
          <span>Играть</span>
        </motion.button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
