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
} from "lucide-react";
import {
  ALL_ITEMS,
  isObstacleCellState,
  type CellState,
  type GameState,
  type ProgressionState,
  type CoinFlyState,
} from "../types";

function dirtyStageClass(cellState: CellState): "cell-dirty-2" | "cell-dirty-1" | null {
  if (cellState === "dirty_2") return "cell-dirty-2";
  if (cellState === "dirty_1") return "cell-dirty-1";
  return null;
}

export interface GameScreenProps {
  state: GameState;
  progState: ProgressionState;
  showOrderCoinBonus: boolean;
  spawnEnergyCost: number;
  showFreeSpawnLabel?: boolean;
  /** Бесплатный спавн и кнопка «СОЗДАТЬ» без порога энергии */
  devMode: boolean;
  onToggleDevMode: () => void;
  xpProgressPercent: number;
  onGoHome: () => void;
  onSpawn: () => void;
  onFreeSpawnAttempt: () => void;
  onCellClick: (index: number, shiftKey?: boolean) => void;
  onCompleteOrder: (orderId: string) => void;
  onOpenTutorial: () => void;
  selectedCell: number | null;
  mergePopIndex: number | null;
  /** Краткая подсветка соседних клеток после снятия препятствия */
  cellUnlockedFlashIndices?: number[];
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
}

export default function GameScreen({
  state,
  progState,
  showOrderCoinBonus,
  spawnEnergyCost,
  showFreeSpawnLabel = false,
  devMode,
  onToggleDevMode,
  xpProgressPercent,
  onGoHome,
  onSpawn,
  onFreeSpawnAttempt,
  onCellClick,
  onCompleteOrder,
  onOpenTutorial,
  selectedCell,
  mergePopIndex,
  cellUnlockedFlashIndices = [],
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
}: GameScreenProps) {
  const hasEmptyForSpawn = state.grid.some((c) => c.item === null);
  const canSpawnPaid =
    devMode || (hasEmptyForSpawn && state.energy >= spawnEnergyCost);

  const createHint = !devMode
    ? !hasEmptyForSpawn
      ? "Нет свободной клетки"
      : state.energy === 0
        ? "Нет энергии"
        : state.energy < spawnEnergyCost
          ? `Нужно ${spawnEnergyCost} энергии`
          : null
    : null;

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
        title="Режим разработчика: без траты энергии на спавн"
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

      {/* Orders */}
      <div className="no-scrollbar mb-1.5 flex w-full flex-shrink-0 gap-2 overflow-x-auto pb-1">
        {state.orders.map((order) => {
          const item = ALL_ITEMS[order.requiredItemId];
          const hasItem = state.grid.some((cell) => cell.item === order.requiredItemId);
          return (
            <motion.div
              key={order.id}
              layout
              className={`w-24 flex-shrink-0 rounded-lg border-2 bg-white p-1.5 transition-colors ${hasItem ? "border-green-400 bg-green-50" : "border-gray-100"}`}
            >
              <div className="mb-0.5 flex items-start justify-between">
                <span className="text-lg">{item.emoji}</span>
                {hasItem && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              </div>
              <div className="mb-0.5 truncate text-[7px] font-bold uppercase text-gray-400">
                {item.name}
              </div>
              <div className="flex items-center justify-between">
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
                    disabled={!hasItem}
                    className={`rounded px-1 py-0.5 text-[7px] font-bold uppercase ${hasItem ? "bg-green-500 text-white shadow-sm" : "cursor-not-allowed bg-gray-100 text-gray-400"}`}
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
              const isObstacle = isObstacleCellState(cell.cellState);
              const dirtyClass = dirtyStageClass(cell.cellState);
              const isSelected = selectedCell === index;
              const isShaking =
                cellShakePair &&
                (cellShakePair[0] === index || cellShakePair[1] === index);
              const isUnlockFlash = cellUnlockedFlashIndices.includes(index);
              const paidCleanable = isObstacle && dirtyClass !== null && paidCleanMode;
              const cellClasses = [
                "game-grid-cell relative flex h-full w-full min-h-0 min-w-0 items-center justify-center rounded-md transition-colors duration-200",
                isObstacle && dirtyClass !== null
                  ? `${dirtyClass} ${paidCleanable ? "cursor-pointer ring-1 ring-amber-400/60 ring-inset" : "cursor-not-allowed"}`
                  : `cursor-pointer ${isSelected ? "cell-selected bg-blue-50" : "bg-white/50 hover:bg-white/80"}`,
                mergePopIndex === index ? "cell-merge-pop" : "",
                isUnlockFlash ? "cell-unlocked" : "",
                isShaking ? "cell-shake" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={isObstacle && !paidCleanable ? -1 : 0}
                  aria-disabled={isObstacle && !paidCleanable}
                  onClick={(e) => onCellClick(index, e.shiftKey)}
                  onKeyDown={(e) => {
                    if (isObstacle && !paidCleanable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCellClick(index, e.shiftKey);
                    }
                  }}
                  className={cellClasses}
                >
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
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="pointer-events-none text-2xl sm:text-3xl md:text-4xl"
                        >
                          {item.emoji}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {item && (
                    <div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-white/90 px-0.5 text-[6px] font-black text-gray-500 shadow-sm">
                      L{item.level}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls: СОЗДАТЬ + бесплатная попытка + прочее */}
      <div className="mt-1.5 flex w-full flex-shrink-0 items-start gap-2 px-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onSpawn}
            disabled={!canSpawnPaid}
            className={`group relative flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold shadow-md transition-all ${canSpawnPaid ? "bg-blue-500 text-white shadow-blue-100 active:bg-blue-600" : "cursor-not-allowed bg-gray-200 text-gray-400"}`}
          >
            <Zap className="h-5 w-5 flex-shrink-0 fill-current" />
            <span>СОЗДАТЬ</span>
            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full border border-white bg-yellow-400 px-1.5 py-0.5 text-[9px] font-black text-yellow-900">
              <Zap className="h-2 w-2 fill-current" />
              {spawnEnergyCost}
            </div>
          </motion.button>
          {createHint ? (
            <p className="text-center text-[10px] font-semibold leading-tight text-gray-600">{createHint}</p>
          ) : null}
          <div className="relative">
            {showFreeSpawnLabel ? (
              <span
                className="pointer-events-none absolute -top-1 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-emerald-400 px-2 py-0.5 text-[10px] font-black tracking-wide text-emerald-950 shadow"
                aria-hidden
              >
                FREE
              </span>
            ) : null}
            <button
              type="button"
              onClick={onFreeSpawnAttempt}
              className="w-full rounded-xl border-2 border-emerald-500/60 bg-emerald-50 py-2 text-xs font-bold text-emerald-900 transition-colors active:bg-emerald-100"
            >
              Попробовать бесплатно
            </button>
          </div>
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
