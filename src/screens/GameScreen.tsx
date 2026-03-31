/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Coins,
  Star,
  CheckCircle2,
  HelpCircle,
  Lock,
} from "lucide-react";
import {
  ALL_ITEMS,
  isObstacleCellState,
  itemIsGenerator,
  itemIsResourcePickup,
  KEY_ITEM_ID,
  orderCanDeliverFromGrid,
  orderRemainingForItem,
  type CellState,
  type GameState,
  type ProgressionState,
  type CoinFlyState,
} from "../types";
import {
  canDeliverReconstructionItem,
  getCurrentReconstructionStage,
  isReconstructionFullyComplete,
  reconstructionOrdersProgress,
} from "../reconstruction";

function dirtyStageClass(cellState: CellState): "cell-dirty-2" | "cell-dirty-1" | null {
  if (cellState === "dirty_2") return "cell-dirty-2";
  if (cellState === "dirty_1") return "cell-dirty-1";
  return null;
}

export interface GameScreenProps {
  state: GameState;
  progState: ProgressionState;
  showOrderCoinBonus: boolean;
  devMode: boolean;
  onToggleDevMode: () => void;
  xpProgressPercent: number;
  onGoHome: () => void;
  onCellClick: (index: number, shiftKey?: boolean) => void;
  onCompleteOrder: (orderId: string) => void;
  onOpenTutorial: () => void;
  selectedCell: number | null;
  mergePopIndex: number | null;
  /** Краткая подсветка соседних клеток после снятия препятствия */
  cellUnlockedFlashIndices?: number[];
  /** Подсветка клеток с лутом после очистки dirty_1 → normal */
  cellDirtyLootFlashIndices?: number[];
  cellShakePair: [number, number] | null;
  coinFly: CoinFlyState | null;
  gridWidth: number;
  gridHeight: number;
  paidCleanMode: boolean;
  onTogglePaidCleanMode: () => void;
  sessionOrdersCompleted: number;
  sessionOrderGoal: number;
  isSessionComplete: boolean;
  onSessionNewGame: () => void;
  onSessionExitHome: () => void;
  isNoMoves: boolean;
  onShuffleGrid: () => void;
  onNoMovesNewSession: () => void;
  onNoMovesExitHome: () => void;
  /** Сдача предмета в этап «Реконструкция» (если этап требует предметы). */
  onReconstructionDeliver: () => void;
}

export default function GameScreen({
  state,
  progState,
  showOrderCoinBonus,
  devMode,
  onToggleDevMode,
  xpProgressPercent,
  onGoHome,
  onCellClick,
  onCompleteOrder,
  onOpenTutorial,
  selectedCell,
  mergePopIndex,
  cellUnlockedFlashIndices = [],
  cellDirtyLootFlashIndices = [],
  cellShakePair,
  coinFly,
  gridWidth,
  gridHeight,
  paidCleanMode,
  onTogglePaidCleanMode,
  sessionOrdersCompleted,
  sessionOrderGoal,
  isSessionComplete,
  onSessionNewGame,
  onSessionExitHome,
  isNoMoves,
  onShuffleGrid,
  onNoMovesNewSession,
  onNoMovesExitHome,
  onReconstructionDeliver,
}: GameScreenProps) {
  const reconStage = getCurrentReconstructionStage(progState.reconstruction);
  const reconBarActive =
    !isSessionComplete &&
    !isReconstructionFullyComplete(progState.reconstruction) &&
    reconStage != null;
  const reconOrderProg =
    reconStage && reconStage.requirement.type === "orders"
      ? reconstructionOrdersProgress(progState.reconstruction, reconStage)
      : null;
  const reconCanDeliverItem =
    reconStage?.requirement.type === "items" &&
    canDeliverReconstructionItem(progState.reconstruction, state.grid);

  return (
    <div className="relative h-[100dvh] w-full max-w-[360px] mx-auto bg-[#F8F9FA] flex flex-col items-center p-2 font-sans select-none overflow-hidden">
      <button
        type="button"
        onClick={onToggleDevMode}
        className={`absolute right-1 top-1 z-30 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider shadow-sm border ${
          devMode
            ? "border-green-700/30 bg-green-500 text-white"
            : "border-gray-300 bg-gray-300 text-gray-700"
        }`}
        title="Режим разработчика"
        aria-pressed={devMode}
      >
        {devMode ? "DEV: ON" : "DEV: OFF"}
      </button>
      {/* Header + бонус монет заказа */}
      <div className="relative w-full flex-shrink-0 mb-1.5">
        {showOrderCoinBonus ? (
          <div
            className="order-bonus-toast pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max -translate-x-1/2 rounded-lg bg-amber-400 px-3 py-1 text-center text-xs font-black uppercase tracking-wide text-amber-950 shadow-md"
            role="status"
          >
            ×2 бонус!
          </div>
        ) : null}
        <div className="w-full rounded-xl border border-gray-100 bg-white p-2 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-1">
            <Zap className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
            <span className="text-xs font-bold text-blue-700">
              {state.energy}/{state.maxEnergy}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center px-2">
            <div className="mb-0.5 flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                Уровень {progState.level}
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
            <span className="text-xs font-bold text-yellow-700">{progState.coins}</span>
          </div>
        </div>
      </div>

      <div className="mb-1 w-full flex-shrink-0 flex items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          onClick={onGoHome}
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          ← Дом
        </button>
        <span className="text-[10px] font-bold text-gray-600 tabular-nums">
          Заказы: {sessionOrdersCompleted}/{sessionOrderGoal}
        </span>
      </div>

      {reconBarActive ? (
        <div className="mb-1.5 w-full flex-shrink-0 rounded-lg border border-violet-200 bg-violet-50/95 px-2 py-1.5 shadow-sm">
          <div className="mb-0.5 text-[8px] font-black uppercase tracking-wide text-violet-800">
            Реконструкция
          </div>
          {reconOrderProg != null ? (
            <div className="text-[10px] font-bold leading-tight text-violet-950">
              {reconStage!.title}: заказы {reconOrderProg.current}/{reconOrderProg.target}
            </div>
          ) : reconStage!.requirement.type === "items" ? (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 text-[10px] font-bold leading-tight text-violet-950">
                {reconStage!.title}
              </span>
              <button
                type="button"
                onClick={onReconstructionDeliver}
                disabled={!reconCanDeliverItem}
                className={`flex-shrink-0 rounded-md px-2 py-1 text-[8px] font-black uppercase ${
                  reconCanDeliverItem
                    ? "bg-violet-600 text-white shadow-sm"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                Сдать
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Orders */}
      <div className="no-scrollbar mb-1.5 flex w-full flex-shrink-0 gap-2 overflow-x-auto pb-1">
        {state.orders.map((order) => {
          const canDeliver = orderCanDeliverFromGrid(state.grid, order);
          return (
            <motion.div
              key={order.id}
              layout
              className={`min-w-[6.75rem] max-w-[8.5rem] flex-shrink-0 rounded-lg border-2 bg-white p-1.5 transition-colors ${canDeliver ? "border-green-400 bg-green-50" : "border-gray-100"}`}
            >
              <div className="mb-1 space-y-0.5">
                {order.requirements.map((req) => {
                  const def = ALL_ITEMS[req.itemId];
                  const rem = orderRemainingForItem(order, req.itemId);
                  const done = req.count - rem;
                  const rowDone = rem === 0;
                  return (
                    <div
                      key={req.itemId}
                      className={`flex items-center gap-0.5 text-[8px] leading-tight ${rowDone ? "text-green-700" : "text-gray-700"}`}
                    >
                      <span className="text-sm leading-none" aria-hidden>
                        {def?.emoji ?? "•"}
                      </span>
                      <span className="min-w-0 flex-1 font-mono font-bold tabular-nums">
                        {req.itemId}: {done}/{req.count}
                      </span>
                      {rowDone ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" /> : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                <div className="flex items-center gap-0.5">
                  <Coins className="h-2 w-2 text-yellow-600" />
                  <span className="text-[9px] font-bold">{order.rewardCoins}</span>
                </div>
                <div className="relative flex justify-end">
                  {coinFly?.source === "order" && coinFly.orderId === order.id ? (
                    <span
                      className="coin-fly pointer-events-none absolute bottom-full left-1/2 z-10 mb-0.5 -translate-x-1/2 whitespace-nowrap"
                      aria-hidden
                    >
                      +{coinFly.amount} 🍪
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onCompleteOrder(order.id)}
                    disabled={!canDeliver}
                    className={`rounded px-1 py-0.5 text-[7px] font-bold uppercase ${canDeliver ? "bg-green-500 text-white shadow-sm" : "cursor-not-allowed bg-gray-100 text-gray-400"}`}
                  >
                    Отдать
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center py-1">
        <div
          className="relative w-full max-h-full max-w-full overflow-hidden rounded-[1.25rem] border border-white bg-gray-200 p-1 shadow-inner"
          style={{ aspectRatio: `${gridWidth} / ${gridHeight}` }}
        >
          <div
            className="grid h-full w-full min-h-0 gap-1"
            style={{
              gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
              gridTemplateRows: `repeat(${gridHeight}, 1fr)`,
            }}
          >
            {state.grid.map((cell, index) => {
              const itemId = cell.item;
              const item = itemId ? ALL_ITEMS[itemId] : null;
              const isLocked = cell.cellState === "locked";
              const isObstacle = isObstacleCellState(cell.cellState);
              const dirtyClass = dirtyStageClass(cell.cellState);
              const isSelected = selectedCell === index;
              const keyUnlockReady =
                isLocked &&
                selectedCell !== null &&
                state.grid[selectedCell]?.item === KEY_ITEM_ID;
              const isShaking =
                cellShakePair &&
                (cellShakePair[0] === index || cellShakePair[1] === index);
              const isUnlockFlash = cellUnlockedFlashIndices.includes(index);
              const isDirtyLootPop = cellDirtyLootFlashIndices.includes(index);
              const paidCleanable =
                (cell.cellState === "dirty_1" || cell.cellState === "dirty_2") && paidCleanMode;
              const isGen = Boolean(item && itemIsGenerator(item));
              const genNoEnergy = isGen && state.energy <= 0;
              const genBlocked = genNoEnergy;
              const isResPickup = Boolean(item && itemIsResourcePickup(item));
              const resIsCoins = Boolean(isResPickup && item && item.grantsCoins > 0);
              const cellClasses = [
                "game-grid-cell relative flex h-full w-full min-h-0 min-w-0 items-center justify-center rounded-md transition-colors duration-200",
                isLocked
                  ? `cell-locked ${keyUnlockReady ? "cursor-pointer ring-2 ring-amber-400/90 ring-inset" : "cursor-not-allowed"}`
                  : isObstacle && dirtyClass !== null
                    ? `${dirtyClass} ${paidCleanable ? "cursor-pointer ring-1 ring-amber-400/60 ring-inset" : "cursor-not-allowed"}`
                    : `${isGen && genBlocked ? "cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "cell-selected bg-blue-50" : isGen ? (genBlocked ? "cell-is-generator cell-generator-depleted" : "cell-is-generator") : isResPickup ? (resIsCoins ? "cell-resource-coins" : "cell-resource-energy") : "bg-white/50 hover:bg-white/80"}`,
                mergePopIndex === index ? "cell-merge-pop" : "",
                isUnlockFlash ? "cell-unlocked" : "",
                isDirtyLootPop ? "cell-dirty-loot-pop" : "",
                isShaking ? "cell-shake" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={
                    isLocked ? (keyUnlockReady ? 0 : -1) : isObstacle && !paidCleanable ? -1 : 0
                  }
                  aria-disabled={isLocked ? !keyUnlockReady : isObstacle && !paidCleanable}
                  onClick={(e) => onCellClick(index, e.shiftKey)}
                  onKeyDown={(e) => {
                    if (isLocked && !keyUnlockReady) return;
                    if (!isLocked && isObstacle && !paidCleanable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCellClick(index, e.shiftKey);
                    }
                  }}
                  className={cellClasses}
                >
                  {isLocked ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-0.5 bg-slate-800/25"
                      aria-hidden
                    >
                      <Lock
                        className="h-7 w-7 text-slate-700 drop-shadow-md sm:h-8 sm:w-8"
                        strokeWidth={2.25}
                      />
                      <span className="text-[6px] font-black uppercase tracking-wider text-slate-800/90">
                        Замок
                      </span>
                    </div>
                  ) : null}
                  {coinFly?.source === "clean" && coinFly.cellIndex === index ? (
                    <span
                      className="coin-fly pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 -translate-x-1/2 whitespace-nowrap"
                      aria-hidden
                    >
                      +{coinFly.amount} 🍪
                    </span>
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AnimatePresence mode="popLayout">
                      {item && (
                        <motion.div
                          key={`${itemId}-${index}`}
                          initial={{
                            scale: 0,
                            opacity: 0,
                            rotate: isDirtyLootPop ? -14 : 0,
                          }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={
                            isDirtyLootPop
                              ? { type: "spring", stiffness: 420, damping: 17 }
                              : { duration: 0.2 }
                          }
                          className={`pointer-events-none text-2xl sm:text-3xl md:text-4xl ${
                            isGen && !genBlocked
                              ? "drop-shadow-[0_2px_6px_rgba(139,92,246,0.65)]"
                              : isResPickup
                                ? resIsCoins
                                  ? "drop-shadow-[0_2px_10px_rgba(234,179,8,0.55)]"
                                  : "drop-shadow-[0_2px_10px_rgba(56,189,248,0.55)]"
                                : ""
                          }`}
                        >
                          {item.emoji}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {item && itemIsResourcePickup(item) ? (
                    <div
                      className={`absolute bottom-0.5 right-0.5 z-10 rounded border px-0.5 text-[6px] font-black shadow-sm tabular-nums ${
                        item.grantsCoins > 0
                          ? "border-amber-300/90 bg-amber-500 text-white"
                          : "border-sky-400/90 bg-sky-600 text-white"
                      }`}
                      title="Нажми, чтобы забрать"
                    >
                      {item.grantsCoins > 0 ? `+${item.grantsCoins}` : `+${item.grantsEnergy}`}
                    </div>
                  ) : item && !itemIsGenerator(item) && itemId !== KEY_ITEM_ID ? (
                    <div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-white/90 px-0.5 text-[6px] font-black text-gray-500 shadow-sm">
                      L{item.level}
                    </div>
                  ) : null}
                  {isGen ? (
                    <div
                      className={`pointer-events-none absolute bottom-0.5 left-0.5 z-10 text-[8px] font-black leading-none ${
                        genBlocked ? "text-gray-500/90" : "text-violet-700/90"
                      }`}
                      title={genNoEnergy ? "Нет энергии" : "Генератор"}
                    >
                      ⚡
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex w-full flex-shrink-0 items-center gap-2 px-2">
        <div className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-xl border border-violet-200/80 bg-violet-50 px-2 py-2">
          <p className="text-center text-[10px] font-bold leading-snug text-violet-900">
            🧺 генератор · 🔑 замок · 🪙/⚡ награда — клик, чтобы забрать
          </p>
        </div>

        <button
          type="button"
          onClick={onTogglePaidCleanMode}
          aria-label={paidCleanMode ? "Выключить очистку за монеты" : "Очистка грязи за монеты"}
          aria-pressed={paidCleanMode}
          title="Очистка за монеты или Shift+клик по грязной клетке"
          className={`flex-shrink-0 rounded-lg border p-2.5 shadow-sm transition-colors ${
            paidCleanMode
              ? "border-amber-400 bg-amber-100 text-amber-800"
              : "border-gray-100 bg-white text-gray-500 hover:text-amber-600"
          }`}
        >
          <Coins className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onOpenTutorial}
          className="flex-shrink-0 rounded-lg border border-gray-100 bg-white p-2.5 text-gray-400 shadow-sm transition-colors hover:text-blue-500"
          aria-label="Справка"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes order-bonus-toast-fade {
          0% { opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { opacity: 0; }
        }
        .order-bonus-toast {
          animation: order-bonus-toast-fade 1.5s ease forwards;
        }
        @keyframes merge-pop {
          0% { transform: scale(0.5); opacity: 0.5; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        .cell-merge-pop {
          animation: merge-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
       @keyframes cell-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .cell-selected {
          animation: cell-pulse 0.6s ease-in-out infinite;
          border: 2px solid #378ADD;
          box-sizing: border-box;
        }
        .cell-resource-coins {
          background: linear-gradient(160deg, rgba(254, 243, 199, 0.95), rgba(251, 191, 36, 0.35));
          box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.45);
        }
        .cell-resource-energy {
          background: linear-gradient(160deg, rgba(224, 242, 254, 0.95), rgba(56, 189, 248, 0.3));
          box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.45);
        }
        .cell-is-generator {
          background: linear-gradient(145deg, rgba(237, 233, 254, 0.95), rgba(221, 214, 254, 0.75));
          box-shadow: inset 0 0 0 2px rgba(139, 92, 246, 0.45);
        }
        .cell-is-generator:hover {
          background: linear-gradient(145deg, rgba(245, 243, 255, 1), rgba(233, 213, 255, 0.9));
        }
        .cell-generator-depleted {
          opacity: 0.72;
          filter: grayscale(0.35);
        }
        .cell-generator-depleted:hover {
          opacity: 0.8;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .cell-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes cell-unlock-flash {
          0% {
            transform: scale(1);
            filter: brightness(1);
            box-shadow: 0 0 0 0 transparent, inset 0 0 0 0 transparent;
          }
          45% {
            transform: scale(1.06);
            filter: brightness(1.2);
            box-shadow:
              0 0 16px 2px rgba(187, 247, 208, 0.9),
              inset 0 0 20px rgba(255, 255, 255, 0.45);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
            box-shadow: 0 0 0 0 transparent, inset 0 0 0 0 transparent;
          }
        }
        .cell-unlocked {
          animation: cell-unlock-flash 0.3s ease-out forwards;
        }
        @keyframes dirty-loot-reveal {
          0% {
            transform: scale(1);
            box-shadow: inset 0 0 0 0 transparent, 0 0 0 0 rgba(52, 211, 153, 0);
          }
          45% {
            transform: scale(1.06);
            box-shadow:
              inset 0 0 12px rgba(167, 243, 208, 0.55),
              0 0 18px 4px rgba(52, 211, 153, 0.45);
          }
          100% {
            transform: scale(1);
            box-shadow: inset 0 0 0 0 transparent, 0 0 0 0 transparent;
          }
        }
        .cell-dirty-loot-pop {
          animation: dirty-loot-reveal 0.48s cubic-bezier(0.34, 1.45, 0.64, 1);
          z-index: 6;
        }
        .cell-locked {
          background: linear-gradient(160deg, rgba(148, 163, 184, 0.45), rgba(100, 116, 139, 0.55));
          box-shadow: inset 0 0 0 2px rgba(51, 65, 85, 0.55);
        }
        /* Препятствия: та же диагональная «blocked»-эстетика; dirty_2 тяжелее, dirty_1 светлее */
        .cell-dirty-2 {
          background-color: rgba(51, 65, 85, 0.88);
          background-image: repeating-linear-gradient(
            -36deg,
            rgba(15, 23, 42, 0.28),
            rgba(15, 23, 42, 0.28) 4px,
            transparent 4px,
            transparent 8px
          );
          box-shadow:
            inset 0 0 0 2px rgba(15, 23, 42, 0.75),
            inset 0 2px 6px rgba(0, 0, 0, 0.25);
          color: rgba(255, 255, 255, 0.9);
        }
        .cell-dirty-1 {
          background-color: rgba(71, 85, 105, 0.7);
          background-image: repeating-linear-gradient(
            -36deg,
            rgba(15, 23, 42, 0.16),
            rgba(15, 23, 42, 0.16) 4px,
            transparent 4px,
            transparent 8px
          );
          box-shadow:
            inset 0 0 0 2px rgba(100, 116, 139, 0.5),
            inset 0 2px 4px rgba(0, 0, 0, 0.14);
          color: rgba(255, 255, 255, 0.88);
        }
        @keyframes coin-fly {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
        .coin-fly {
          animation: coin-fly 0.8s ease-out forwards;
          font-size: 14px;
          font-weight: 500;
          color: #BA7517;
        }
      `}</style>

      {isSessionComplete ? (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-complete-title"
        >
          <div className="w-full max-w-[280px] rounded-2xl bg-white p-5 text-center shadow-xl">
            <h2 id="session-complete-title" className="mb-2 text-lg font-black text-gray-900">
              Сессия завершена!
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Выполнено заказов:{" "}
              <span className="font-bold tabular-nums text-gray-800">
                {sessionOrdersCompleted} / {sessionOrderGoal}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onSessionNewGame}
                className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-white shadow-md active:bg-green-600"
              >
                Продолжить
              </button>
              <button
                type="button"
                onClick={onSessionExitHome}
                className="w-full rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 shadow-sm active:bg-gray-50"
              >
                Выйти домой
              </button>
            </div>
          </div>
        </div>
      ) : isNoMoves ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4"
          aria-live="polite"
        >
          <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="no-moves-title"
            className="pointer-events-auto w-full max-w-[280px] rounded-2xl border border-gray-200 bg-white/95 p-5 text-center shadow-xl"
          >
            <h2 id="no-moves-title" className="mb-4 text-lg font-black text-gray-900">
              Нет доступных ходов
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onShuffleGrid}
                className="w-full rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 shadow-sm active:bg-gray-50"
              >
                Перемешать поле
              </button>
              <button
                type="button"
                onClick={onNoMovesNewSession}
                className="w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-white shadow-md active:bg-blue-600"
              >
                Начать новую сессию
              </button>
              <button
                type="button"
                onClick={onNoMovesExitHome}
                className="w-full rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 shadow-sm active:bg-gray-50"
              >
                Выйти домой
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
