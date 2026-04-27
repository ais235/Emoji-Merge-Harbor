/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Zap, Coins, Star } from "lucide-react";
import { motion } from "motion/react";
import type { ActiveZone } from "../types";
import { progressZoneId } from "../types";
import { HUB_ZONES, roomFurnitureProgress } from "../progressionData";

export interface CafeHubScreenProps {
  energy: number;
  maxEnergy: number;
  level: number;
  coins: number;
  xpProgressPercent: number;
  unlockedZones: string[];
  purchasedUpgrades: string[];
  /** Текущая комната миниигры — подсветка карточки. */
  currentPlayZone: ActiveZone;
  onNavigateRoom: (zone: ActiveZone) => void;
  dailyQuestCompleted: number;
  dailyQuestTotal: number;
  dailyUnclaimedCount: number;
  onOpenDaily: () => void;
  onOpenCoinShop?: () => void;
  onOpenCollection?: () => void;
  onBackToMenu: () => void;
  onPlay: () => void;
  repairNudgeZone?: ActiveZone | null;
  hubOrdersToast?: string | null;
  pulsePlayButton?: boolean;
}

export default function CafeHubScreen({
  energy,
  maxEnergy,
  level,
  coins,
  xpProgressPercent,
  unlockedZones,
  purchasedUpgrades,
  currentPlayZone,
  onNavigateRoom,
  dailyQuestCompleted,
  dailyQuestTotal,
  dailyUnclaimedCount,
  onOpenDaily,
  onOpenCoinShop,
  onOpenCollection,
  onBackToMenu,
  onPlay,
  repairNudgeZone = null,
  hubOrdersToast = null,
  pulsePlayButton = false,
}: CafeHubScreenProps) {
  const nudgeRoomName =
    repairNudgeZone != null
      ? (HUB_ZONES.find((z) => z.id === repairNudgeZone)?.displayName ?? "комнату")
      : "";

  return (
    <div className="ds-screen ds-screen-hub flex min-h-0 flex-col overflow-hidden">
      <header className="ds-topbar">
        <button type="button" onClick={onBackToMenu} className="ds-pill-home shrink-0">
          ← Меню
        </button>
        <h1 className="ds-topbar-title">Дом</h1>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onPlay}
          animate={
            pulsePlayButton
              ? { scale: [1, 1.04, 1] }
              : false
          }
          transition={pulsePlayButton ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : undefined}
          className="ds-btn-primary shrink-0 px-3 py-2 text-[11px]"
        >
          Играть
        </motion.button>
      </header>

      <div className="no-scrollbar scroll-touch-y min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="ds-card-peach mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="ds-stat-pill shrink-0">
              <Zap className="h-3 w-3 shrink-0" style={{ color: "var(--c-bluedark)" }} aria-hidden />
              <span className="tabular-nums">
                {energy}/{maxEnergy}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center px-1">
              <div className="mb-0.5 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                <span className="text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
                  Уровень {level}
                </span>
              </div>
              <div className="ds-progress w-full max-w-[140px]">
                <div
                  className="ds-progress__fill ds-progress__fill--gold"
                  style={{ width: `${Math.min(xpProgressPercent, 100)}%` }}
                />
              </div>
            </div>
            <div className="ds-stat-pill shrink-0">
              <Coins className="h-3 w-3 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
              <span className="tabular-nums">{coins}</span>
            </div>
          </div>
        </div>

        <div className="ds-hub-util-grid mb-3">
          <button type="button" onClick={onOpenDaily} className="relative ds-hub-util-btn">
            {dailyUnclaimedCount > 0 ? (
              <span className="ds-badge absolute -right-0.5 -top-0.5 z-[1] min-w-[16px] px-1">{dailyUnclaimedCount}</span>
            ) : null}
            <span className="text-lg leading-none" aria-hidden>
              📋
            </span>
            <span>Задания</span>
          </button>
          <button
            type="button"
            disabled={!onOpenCoinShop}
            onClick={() => onOpenCoinShop?.()}
            className={`ds-hub-util-btn ${!onOpenCoinShop ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <span className="text-lg leading-none" aria-hidden>
              🛠️
            </span>
            <span>Улучшения</span>
          </button>
          <button
            type="button"
            disabled={!onOpenCollection}
            onClick={() => onOpenCollection?.()}
            className={`ds-hub-util-btn ${!onOpenCollection ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <span className="text-lg leading-none" aria-hidden>
              📚
            </span>
            <span>Коллекция</span>
          </button>
        </div>

        <p className="mb-1.5 text-center text-[10px] font-medium" style={{ color: "var(--c-muted)" }}>
          Комнаты
        </p>
        <div className="space-y-2 pb-[env(safe-area-inset-bottom,12px)]">
          {HUB_ZONES.map((zone) => {
            const key = progressZoneId(zone.id);
            const isOpen = unlockedZones.includes(key);
            const isRepairNudge = repairNudgeZone != null && zone.id === repairNudgeZone;
            const isCurrent = zone.id === currentPlayZone;
            const { bought: furnBought, total: furnTotal } = roomFurnitureProgress(zone.id, purchasedUpgrades);
            const levelsLeft = Math.max(0, zone.unlockLevel - level);
            return (
              <motion.div
                key={zone.id}
                animate={
                  isRepairNudge
                    ? { opacity: [1, 0.92, 1] }
                    : false
                }
                transition={isRepairNudge ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined}
                className={`flex items-center gap-2 rounded-[var(--ds-radius-card)] bg-[var(--c-cream)] p-2.5 ${
                  isCurrent && isOpen
                    ? "ds-card-active-blue"
                    : `border ${isRepairNudge ? "border-[var(--c-rose)]" : "border-[var(--c-peach2)]"}`
                } ${!isOpen ? "opacity-50" : ""}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl leading-none"
                  aria-hidden
                >
                  {zone.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium" style={{ color: "var(--c-browndark)" }}>
                    {zone.displayName}
                  </div>
                  {isOpen ? (
                    <div className="mt-1">
                      {furnTotal > 0 ? (
                        <>
                          <div className="ds-progress mb-0.5 w-full max-w-[160px]">
                            <div
                              className="ds-progress__fill ds-progress__fill--green"
                              style={{
                                width: `${furnTotal > 0 ? Math.min(100, (furnBought / furnTotal) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <div className="text-[9px] font-medium tabular-nums" style={{ color: "var(--c-brown)" }}>
                            {furnBought}/{furnTotal}
                          </div>
                        </>
                      ) : (
                        <span className="text-[9px] font-medium" style={{ color: "var(--c-greendark)" }}>
                          Открыта
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[9px] font-medium leading-snug" style={{ color: "var(--c-muted)" }}>
                      🔒 Ур. {zone.unlockLevel}
                      {levelsLeft > 0 ? ` · ещё ${levelsLeft} ур.` : ""}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!isOpen}
                  onClick={() => onNavigateRoom(zone.id)}
                  className={
                    isOpen
                      ? "ds-btn-primary shrink-0 px-3 py-2 text-[11px]"
                      : "ds-btn-secondary ds-btn-disabled shrink-0 px-2 py-2 text-[10px]"
                  }
                >
                  Войти
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {repairNudgeZone != null ? (
        <div
          className="flex-shrink-0 border-t px-3 py-2.5 text-center"
          style={{ borderColor: "var(--c-peach2)", background: "var(--c-peach)" }}
        >
          <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--c-browndark)" }}>
            Отремонтируйте «{nudgeRoomName}», чтобы продолжить задания в миниигре
          </p>
        </div>
      ) : null}
      {hubOrdersToast ? (
        <div
          className="flex-shrink-0 border-t px-3 py-2.5 text-center"
          style={{ borderColor: "var(--c-peach2)", background: "var(--c-cream)" }}
        >
          <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--c-greendark)" }}>
            {hubOrdersToast}
          </p>
        </div>
      ) : null}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
