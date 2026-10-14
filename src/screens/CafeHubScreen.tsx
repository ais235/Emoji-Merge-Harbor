/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useUiScaling } from "../hooks/useUiScaling";
import { Zap, Coins, Star } from "lucide-react";
import { motion } from "motion/react";
import { ALL_ITEMS, progressZoneId, type ActiveZone, type ReconstructionState } from "../types";
import { HUB_ZONES, roomFurnitureProgress } from "../progressionData";
import {
  getCurrentReconstructionStage,
  isReconstructionFullyComplete,
  reconstructionItemRemaining,
  reconstructionOrdersProgress,
} from "../reconstruction";

export interface CafeHubScreenProps {
  energy: number;
  maxEnergy: number;
  level: number;
  coins: number;
  xpProgressPercent: number;
  unlockedZones: string[];
  purchasedUpgrades: string[];
  onNavigateRoom: (zone: ActiveZone) => void;
  dailyUnclaimedCount: number;
  onOpenDaily: () => void;
  onOpenCoinShop?: () => void;
  onOpenCollection?: () => void;
  onBackToMenu: () => void;
  onPlay: () => void;
  hubOrdersToast?: string | null;
  pulsePlayButton?: boolean;
  /** Цепочка «Реконструкция кафе» — текущий этап и его прогресс. */
  reconstruction: ReconstructionState;
  /** Можно ли прямо сейчас сдать предмет в этап типа `items` (есть на поле). */
  canDeliverReconstructionItem: boolean;
  onDeliverReconstructionItem: () => void;
}

export default function CafeHubScreen({
  energy,
  maxEnergy,
  level,
  coins,
  xpProgressPercent,
  unlockedZones,
  purchasedUpgrades,
  onNavigateRoom,
  dailyUnclaimedCount,
  onOpenDaily,
  onOpenCoinShop,
  onOpenCollection,
  onBackToMenu,
  onPlay,
  hubOrdersToast = null,
  pulsePlayButton = false,
  reconstruction,
  canDeliverReconstructionItem,
  onDeliverReconstructionItem,
}: CafeHubScreenProps) {
  const reconStage = getCurrentReconstructionStage(reconstruction);
  const reconDone = isReconstructionFullyComplete(reconstruction);
  const reconOrders = reconStage ? reconstructionOrdersProgress(reconstruction, reconStage) : null;
  const { containerRef, scalingStyle } = useUiScaling();

  return (
    <div
      ref={containerRef}
      className="ds-screen ds-screen-hub flex min-h-0 flex-col overflow-hidden"
      style={scalingStyle}
    >
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
          className="ds-btn-primary shrink-0 px-3 py-2 text-[12px]"
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
                <span className="text-[11px] font-medium" style={{ color: "var(--c-brown)" }}>
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

        {reconStage && !reconDone ? (
          <div className="ds-card-peach mb-3">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-base leading-none" aria-hidden>
                🔨
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--c-browndark)" }}>
                {reconStage.title}
              </span>
            </div>
            <p className="mb-2 text-[10px] font-medium leading-snug" style={{ color: "var(--c-brown)" }}>
              {reconStage.description}
            </p>

            {reconOrders ? (
              <>
                <div className="ds-progress mb-1 w-full">
                  <div
                    className="ds-progress__fill ds-progress__fill--green"
                    style={{
                      width: `${Math.min(100, (reconOrders.current / Math.max(1, reconOrders.target)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-medium tabular-nums" style={{ color: "var(--c-brown)" }}>
                  Заказов: {Math.min(reconOrders.current, reconOrders.target)}/{reconOrders.target}
                </div>
              </>
            ) : null}

            {reconStage.requirement.type === "items" ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {reconStage.requirement.needs.map((need) => {
                    const left = reconstructionItemRemaining(reconstruction, reconStage, need.itemId);
                    const done = need.count - left;
                    return (
                      <div
                        key={need.itemId}
                        className="flex items-center gap-1 rounded-lg border border-[var(--c-peach2)] bg-[var(--c-cream)] px-1.5 py-1"
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {ALL_ITEMS[need.itemId]?.emoji ?? "❓"}
                        </span>
                        <span
                          className="text-[10px] font-medium tabular-nums"
                          style={{ color: left === 0 ? "var(--c-greendark, #2E7D32)" : "var(--c-brown)" }}
                        >
                          {done}/{need.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onDeliverReconstructionItem}
                  disabled={!canDeliverReconstructionItem}
                  className={`w-full ${canDeliverReconstructionItem ? "ds-btn-primary" : "ds-btn-secondary opacity-60"}`}
                >
                  {canDeliverReconstructionItem ? "Сдать предмет" : "Нужный предмет не найден на поле"}
                </button>
              </>
            ) : null}

            <div className="mt-2 text-[10px] font-medium" style={{ color: "var(--c-muted)" }}>
              Награда: {reconStage.rewardCoins} монет · {reconStage.rewardXp} опыта
            </div>
          </div>
        ) : null}

        <p className="mb-1.5 text-center text-[10px] font-medium" style={{ color: "var(--c-muted)" }}>
          Комнаты
        </p>
        <div className="space-y-2 pb-[env(safe-area-inset-bottom,12px)]">
          {HUB_ZONES.map((zone) => {
            const key = progressZoneId(zone.id);
            const isOpen = unlockedZones.includes(key);
            const { bought: furnBought, total: furnTotal } = roomFurnitureProgress(zone.id, purchasedUpgrades);
            const levelsLeft = Math.max(0, zone.unlockLevel - level);
            return (
              <motion.div
                key={zone.id}
                animate={false}
                transition={undefined}
                className={`flex items-center gap-2 rounded-[var(--ds-radius-card)] border border-[var(--c-peach2)] bg-[var(--c-cream)] p-2.5 ${
                  !isOpen ? "opacity-50" : ""
                }`}
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
