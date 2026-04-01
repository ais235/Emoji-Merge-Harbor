/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Zap, Coins, Star } from "lucide-react";
import { motion } from "motion/react";
import type { ActiveZone, ReconstructionState } from "../types";
import { progressZoneId } from "../types";
import { HUB_ZONES } from "../progressionData";
import ReconstructionPanel from "../components/ReconstructionPanel";

export interface CafeHubScreenProps {
  energy: number;
  maxEnergy: number;
  level: number;
  coins: number;
  xpProgressPercent: number;
  unlockedZones: string[];
  onNavigateRoom: (zone: ActiveZone) => void;
  dailyQuestCompleted: number;
  dailyQuestTotal: number;
  dailyUnclaimedCount: number;
  onOpenDaily: () => void;
  onOpenCoinShop?: () => void;
  onOpenCollection?: () => void;
  reconstruction: ReconstructionState;
  onBackToMenu: () => void;
  onPlay: () => void;
}

export default function CafeHubScreen({
  energy,
  maxEnergy,
  level,
  coins,
  xpProgressPercent,
  unlockedZones,
  onNavigateRoom,
  dailyQuestCompleted,
  dailyQuestTotal,
  dailyUnclaimedCount,
  onOpenDaily,
  onOpenCoinShop,
  onOpenCollection,
  reconstruction,
  onBackToMenu,
  onPlay,
}: CafeHubScreenProps) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[400px] flex-col overflow-hidden bg-[#E8EDF2] font-sans select-none">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200/90 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={onBackToMenu}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-600 active:bg-gray-50"
        >
          ← Меню
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-black text-gray-900">Дом</h1>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onPlay}
          className="flex-shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-black uppercase text-white shadow-sm active:bg-blue-600"
        >
          Играть
        </motion.button>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <div className="mb-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5">
              <Zap className="h-3 w-3 fill-blue-500 text-blue-500" />
              <span className="text-[10px] font-bold text-blue-700">
                {energy}/{maxEnergy}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center px-2">
              <div className="mb-0.5 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                <span className="text-[8px] font-bold uppercase text-gray-500">Ур. {level}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full max-w-full bg-yellow-400 transition-all"
                  style={{ width: `${Math.min(xpProgressPercent, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-yellow-100 bg-yellow-50 px-2 py-0.5">
              <Coins className="h-3 w-3 fill-yellow-600 text-yellow-600" />
              <span className="text-[10px] font-bold text-yellow-700">{coins}</span>
            </div>
          </div>
        </div>

        <ReconstructionPanel reconstruction={reconstruction} />

        <button
          type="button"
          onClick={onOpenDaily}
          className="relative mb-2 mt-1 w-full rounded-xl border border-gray-100 bg-white p-2.5 text-left shadow-sm active:bg-gray-50"
        >
          {dailyUnclaimedCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
              {dailyUnclaimedCount}
            </span>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xl" aria-hidden>
                📋
              </span>
              <div>
                <div className="text-xs font-bold text-gray-900">Ежедневные задания</div>
                <div className="text-[10px] text-gray-500">
                  {dailyQuestCompleted} / {dailyQuestTotal}
                </div>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </button>

        {onOpenCoinShop ? (
          <button
            type="button"
            onClick={onOpenCoinShop}
            className="mb-2 w-full rounded-xl border border-gray-100 bg-white p-2.5 text-left shadow-sm active:bg-gray-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xl" aria-hidden>
                  🛠️
                </span>
                <div>
                  <div className="text-xs font-bold text-gray-900">Улучшения игры</div>
                  <div className="text-[10px] text-gray-500">Магазин за монеты</div>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>
        ) : null}

        {onOpenCollection ? (
          <button
            type="button"
            onClick={onOpenCollection}
            className="mb-2 w-full rounded-xl border border-gray-100 bg-white p-2.5 text-left shadow-sm active:bg-gray-50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xl" aria-hidden>
                  📚
                </span>
                <div>
                  <div className="text-xs font-bold text-gray-900">Коллекция</div>
                  <div className="text-[10px] text-gray-500">Предметы и награды</div>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </button>
        ) : null}

        <p className="mb-1 text-center text-[10px] text-gray-400">Комнаты</p>
        <div className="space-y-1.5 pb-[env(safe-area-inset-bottom,12px)]">
          {HUB_ZONES.map((zone) => {
            const key = progressZoneId(zone.id);
            const isOpen = unlockedZones.includes(key);
            return (
              <div
                key={zone.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2 shadow-sm"
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-3xl leading-none"
                  aria-hidden
                >
                  {zone.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-gray-900">{zone.displayName}</div>
                  <div className="text-[9px] text-gray-500">
                    {isOpen ? (
                      <span className="text-green-600">Открыта</span>
                    ) : (
                      <>🔒 Ур. {zone.unlockLevel}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isOpen}
                  onClick={() => onNavigateRoom(zone.id)}
                  className={`flex-shrink-0 rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase ${
                    isOpen ? "bg-blue-500 text-white" : "cursor-not-allowed bg-gray-100 text-gray-300"
                  }`}
                >
                  Войти
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
