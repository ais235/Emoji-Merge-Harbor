/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CircleAlert, HelpCircle } from "lucide-react";
import {
  ALL_ITEMS,
  isCobwebUnknownPlaceholder,
  isBlockedCellType,
  isOpenCellType,
  itemIsGenerator,
  itemIsResourcePickup,
  itemCellShowsOrderReadyCheck,
  type GameState,
  type GridCell,
  type ProgressionState,
  type CoinFlyState,
} from "../types";
import GameSelectionInfoModal from "../components/GameSelectionInfoModal";
import { FieldDialogProvider } from "../components/FieldDialogPanel";
import { GameHeader } from "../components/GameHeader";
import OrderItemInfoModal from "../components/OrderItemInfoModal";
import MergeBurstParticles from "../components/MergeBurstParticles";
import { OrderCard } from "../components/OrderCard";
import { ENERGY_AD_REWARD } from "../gameBalance";

const GRID_DRAG_THRESHOLD_PX = 12;

/** px-0.5 у ряда сетки + рамка p-1 + border ~1px с каждой стороны (горизонтальный «хром» вокруг клеток) */
const GRID_WRAP_CHROME_H_PX = 14;
/** Верхняя граница размера ячейки на очень широких портретах */
const GRID_CELL_MAX_PX = 58;
const GRID_GAP_PX = 2;

function computeGridCellSize(columnContentWidth: number, gridW: number): number {
  const usable = Math.max(120, columnContentWidth - GRID_WRAP_CHROME_H_PX);
  const raw = Math.floor((usable - (gridW - 1) * GRID_GAP_PX) / gridW);
  return Math.max(24, Math.min(GRID_CELL_MAX_PX, raw));
}

/**
 * С этой ячейки можно начать перетаскивание.
 * Награды 🪙/⚡ — один клик забрать. Генератор: клик выделяет, второй клик по нему — выдача; таскать можно.
 */
function cellAllowsGridDragSource(cell: GridCell): boolean {
  if (!cell.item) return false;
  if (!isOpenCellType(cell.cellType)) return false;
  const def = ALL_ITEMS[cell.item];
  if (!def) return false;
  if (itemIsResourcePickup(def)) return false;
  return true;
}

export interface GameScreenProps {
  state: GameState;
  progState: ProgressionState;
  showOrderCoinBonus: boolean;
  devMode: boolean;
  /** До следующей +1 энергии (считает родитель, тик раз в секунду в игре) */
  msUntilNextEnergy: number;
  /** XP до следующего уровня (знаменатель полосы опыта) */
  xpToNextLevel: number;
  onGoHome: () => void;
  onCellClick: (index: number, shiftKey?: boolean) => void;
  /** Слияние/обмен как второй шаг, но через перетаскивание с from на to. */
  onCellPairDrop: (from: number, to: number, shiftKey: boolean) => void;
  onCompleteOrder: (orderId: string, orderInstanceId: string, deliverButtonRect?: DOMRect) => void;
  onOpenTutorial: () => void;
  selectedCell: number | null;
  mergePopIndex: number | null;
  /** Краткая подсветка соседних клеток после снятия препятствия */
  cellUnlockedFlashIndices?: number[];
  /** Усиленная вспышка (открытие ящика с генератором). */
  cellUnlockHeavyFlash?: boolean;
  cellShakePair: [number, number] | null;
  coinFly: CoinFlyState | null;
  /** Ячейка слияния — частицы в portal */
  mergeBurstCellIndex?: number | null;
  soundOn?: boolean;
  onToggleGameSound?: () => void;
  gridWidth: number;
  gridHeight: number;
  /** Лимит заказов миниигры для текущей комнаты (ремонт в хабе). */
  minigameOrdersCompletedAtRoom: number;
  maxMinigameOrdersAtRoom: number;
  /** Нет активных заказов и лимит исчерпан — показать заглушку «в хаб». */
  ordersExhausted: boolean;
  /** Стоимость следующего визуального ремонта в текущей комнате; null — всё куплено. */
  nextRepairCost: number | null;
  /** Монеты игрока (для подсказки на заглушке). */
  playerCoins: number;
  /** Из заглушки исчерпанных заказов — хаб с подсветкой комнаты. */
  onOrdersExhaustedGoHome: () => void;
  onSessionExitHome: () => void;
  isNoMoves: boolean;
  onNoMovesExitHome: () => void;
  /** Заглушка рекламы: +энергия (в проде — SDK). */
  onWatchAdEnergy: () => void;
}

function GameScreenContent({
  state,
  progState,
  showOrderCoinBonus,
  devMode,
  msUntilNextEnergy,
  xpToNextLevel,
  onGoHome,
  onCellClick,
  onCellPairDrop,
  onCompleteOrder,
  onOpenTutorial,
  selectedCell,
  mergePopIndex,
  cellUnlockedFlashIndices = [],
  cellUnlockHeavyFlash = false,
  cellShakePair,
  coinFly,
  mergeBurstCellIndex = null,
  soundOn = true,
  onToggleGameSound,
  gridWidth,
  gridHeight,
  minigameOrdersCompletedAtRoom,
  maxMinigameOrdersAtRoom,
  ordersExhausted,
  nextRepairCost,
  playerCoins,
  onOrdersExhaustedGoHome,
  onSessionExitHome,
  isNoMoves,
  onNoMovesExitHome,
  onWatchAdEnergy,
}: GameScreenProps) {
  const [selectionInfoOpen, setSelectionInfoOpen] = useState(false);
  const [orderItemInfoId, setOrderItemInfoId] = useState<string | null>(null);
  const [roomOrderBarFlash, setRoomOrderBarFlash] = useState(false);
  const prevRoomOrderRatioRef = useRef<number>(0);
  const gameColumnRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(36);

  useLayoutEffect(() => {
    const el = gameColumnRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 16;
      const inner = Math.max(0, el.clientWidth - padX);
      setCellSize(computeGridCellSize(inner, gridWidth));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridWidth]);

  const roomOrderRatio =
    maxMinigameOrdersAtRoom > 0 ? minigameOrdersCompletedAtRoom / maxMinigameOrdersAtRoom : 0;
  useEffect(() => {
    if (maxMinigameOrdersAtRoom <= 0) return;
    const prev = prevRoomOrderRatioRef.current;
    prevRoomOrderRatioRef.current = roomOrderRatio;
    if (roomOrderRatio >= 1 && prev < 1) {
      setRoomOrderBarFlash(true);
      const t = window.setTimeout(() => setRoomOrderBarFlash(false), 700);
      return () => window.clearTimeout(t);
    }
  }, [roomOrderRatio, maxMinigameOrdersAtRoom]);

  /** Актуальная сетка для нативных слушателей window (вне замыкания React). */
  const gridSnapshotRef = useRef(state.grid);
  gridSnapshotRef.current = state.grid;

  const dragRef = useRef<{
    pointerId: number;
    from: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const globalDragListenersRef = useRef<{
    move: (ev: PointerEvent) => void;
    up: (ev: PointerEvent) => void;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const pairDropRef = useRef(onCellPairDrop);
  pairDropRef.current = onCellPairDrop;

  const [dragGhost, setDragGhost] = useState<{
    from: number;
    emoji: string;
    x: number;
    y: number;
  } | null>(null);

  const gridPixelWidth =
    gridWidth * cellSize + (gridWidth > 0 ? (gridWidth - 1) * GRID_GAP_PX : 0);
  const gridPixelHeight =
    gridHeight * cellSize + (gridHeight > 0 ? (gridHeight - 1) * GRID_GAP_PX : 0);
  const emojiFontPx = Math.min(26, Math.max(12, Math.floor(cellSize * 0.52)));

  function clearGlobalDragListeners() {
    const L = globalDragListenersRef.current;
    if (!L) return;
    window.removeEventListener("pointermove", L.move);
    window.removeEventListener("pointerup", L.up);
    window.removeEventListener("pointercancel", L.up);
    globalDragListenersRef.current = null;
  }

  useEffect(() => {
    return () => clearGlobalDragListeners();
  }, []);

  function handleGridCellPointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    index: number,
    cell: GridCell
  ) {
    suppressClickRef.current = false;
    if (e.button !== 0) return;
    if (!cellAllowsGridDragSource(cell)) return;
    const id = cell.item;
    if (!id) return;
    const def = ALL_ITEMS[id];
    if (!def) return;

    clearGlobalDragListeners();

    dragRef.current = {
      pointerId: e.pointerId,
      from: index,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const dist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
      if (!d.moved && dist > GRID_DRAG_THRESHOLD_PX) {
        d.moved = true;
        const pid = gridSnapshotRef.current[d.from]?.item;
        const itemDef = pid ? ALL_ITEMS[pid] : undefined;
        setDragGhost({
          from: d.from,
          emoji: itemDef?.emoji ?? "❓",
          x: ev.clientX,
          y: ev.clientY,
        });
      } else if (d.moved) {
        setDragGhost((g) => (g ? { ...g, x: ev.clientX, y: ev.clientY } : null));
      }
    };

    const up = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      clearGlobalDragListeners();
      if (d.moved) {
        suppressClickRef.current = true;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const wrap = el?.closest("[data-grid-cell-index]");
        const raw = wrap?.getAttribute("data-grid-cell-index");
        const toIdx = raw != null ? Number.parseInt(raw, 10) : Number.NaN;
        if (!Number.isNaN(toIdx) && toIdx >= 0 && toIdx !== d.from) {
          pairDropRef.current(d.from, toIdx, ev.shiftKey);
        }
        setDragGhost(null);
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      dragRef.current = null;
    };

    globalDragListenersRef.current = { move, up };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div
      className="flex w-full min-h-[100dvh] justify-center overflow-x-hidden font-sans select-none"
      style={{ background: "var(--c-cream)" }}
    >
      <div
        ref={gameColumnRef}
        className="relative mx-auto box-border flex w-full max-w-[min(100%,var(--app-content-max))] flex-col px-2 py-2"
      >
      <div className="relative z-[1] mb-1 w-full flex-shrink-0">
        {showOrderCoinBonus ? (
          <div
            className="order-bonus-toast pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max -translate-x-1/2 rounded-[var(--ds-radius-btn)] border px-3 py-1.5 text-center text-[11px] font-medium"
            style={{
              background: "var(--c-gold)",
              borderColor: "var(--c-golddark)",
              color: "var(--c-browndark)",
            }}
            role="status"
          >
            ×2 бонус монет
          </div>
        ) : null}
        <GameHeader
          energy={state.energy}
          maxEnergy={state.maxEnergy}
          msUntilNextEnergy={msUntilNextEnergy}
          coins={progState.coins}
          playerLevel={progState.level}
          playerXP={progState.xp}
          nextLevelXP={xpToNextLevel}
          ordersCompleted={minigameOrdersCompletedAtRoom}
          maxOrders={maxMinigameOrdersAtRoom}
          onGoHome={onGoHome}
          soundOn={soundOn}
          onToggleSound={onToggleGameSound}
        />
      </div>

      <div className="mb-1.5 w-full shrink-0">
        {state.orders.length === 0 && ordersExhausted ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--ds-radius-card)] border border-dashed p-4 text-center"
            style={{ borderColor: "var(--c-rose)", background: "var(--c-peach)" }}
          >
            <span className="text-2xl leading-none" aria-hidden>
              🏠
            </span>
            <span className="text-[11px] font-medium leading-snug" style={{ color: "var(--c-browndark)" }}>
              Отремонтируйте комнату, чтобы получить ещё задания
            </span>
            {nextRepairCost != null ? (
              <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--c-golddark)" }}>
                🍪 {nextRepairCost}
              </span>
            ) : (
              <span className="text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
                Все шаги ремонта в комнате куплены
              </span>
            )}
            <button
              type="button"
              className={
                nextRepairCost != null && playerCoins >= nextRepairCost
                  ? "ds-btn-primary w-full max-w-[200px]"
                  : nextRepairCost != null
                    ? "ds-btn-secondary w-full max-w-[200px] opacity-80"
                    : "ds-btn-primary w-full max-w-[200px]"
              }
              onClick={onOrdersExhaustedGoHome}
            >
              {nextRepairCost != null && playerCoins >= nextRepairCost ? "Ремонтировать" : "В хаб"}
            </button>
          </div>
        ) : (
          <div className="orders-row justify-start px-1.5 py-2">
            {state.orders.map((order) => (
              <OrderCard
                key={order.instanceId}
                order={order}
                grid={state.grid}
                showCoinFly={coinFly?.source === "order" && coinFly.orderId === order.id}
                coinFlyAmount={coinFly?.source === "order" && coinFly.orderId === order.id ? coinFly.amount : 0}
                onItemInfo={(id) => setOrderItemInfoId(id)}
                onDeliver={(id, inst, rect) => onCompleteOrder(id, inst, rect)}
              />
            ))}
          </div>
        )}
        {!ordersExhausted && maxMinigameOrdersAtRoom > 0 ? (
          <div className="w-full px-0.5 pb-1 pt-1">
            <div className="ds-progress w-full" aria-label={`Прогресс заказов комнаты: ${minigameOrdersCompletedAtRoom} из ${maxMinigameOrdersAtRoom}`}>
              <motion.div
                className="ds-progress__fill ds-progress__fill--green"
                initial={false}
                animate={{
                  width: `${Math.min(100, roomOrderRatio * 100)}%`,
                  opacity: roomOrderBarFlash ? [1, 0.72, 1] : 1,
                }}
                transition={{ duration: roomOrderBarFlash ? 0.45 : 0.25 }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <OrderItemInfoModal
        open={orderItemInfoId != null}
        itemId={orderItemInfoId}
        onClose={() => setOrderItemInfoId(null)}
      />

      {/* Поле: квадратные ячейки по ширине экрана, фиксированный размер сетки (страница скроллится при необходимости) */}
      <div className="flex w-full shrink-0 justify-center px-0.5 pb-1">
        <div
          className="relative shrink-0 rounded-[12px] border p-1"
          style={{ borderColor: "var(--c-peach2)", background: "var(--c-peach)" }}
        >
          <div
            className={`grid shrink-0${dragGhost ? " touch-none" : ""}`}
            style={{
              width: gridPixelWidth,
              height: gridPixelHeight,
              gap: GRID_GAP_PX,
              gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${gridHeight}, ${cellSize}px)`,
            }}
          >
            {state.grid.map((cell, index) => {
              const itemId = cell.item;
              const item = itemId ? ALL_ITEMS[itemId] : null;
              const isBox = cell.cellType === "box" || cell.cellType === "hint_box";
              const isHintBox = cell.cellType === "hint_box";
              const isCobweb = cell.cellType === "cobweb";
              const isBlocked = isBlockedCellType(cell.cellType);
              const isSelected = selectedCell === index;
              const isShaking =
                cellShakePair &&
                (cellShakePair[0] === index || cellShakePair[1] === index);
              const isDragSource = dragGhost?.from === index;
              const isUnlockFlash = cellUnlockedFlashIndices.includes(index);
              const unlockFlashStrong = cellUnlockHeavyFlash && isUnlockFlash;
              const canDragFrom = cellAllowsGridDragSource(cell);
              const isGen = Boolean(item && itemIsGenerator(item));
              const genBlocked = isGen && state.energy <= 0;
              const isResPickup = Boolean(item && itemIsResourcePickup(item));
              const resIsCoins = Boolean(isResPickup && item && item.grantsCoins > 0);
              const showOrderReadyOnGrid =
                Boolean(itemId && item) &&
                cell.cellType === "item" &&
                !isGen &&
                !isResPickup &&
                itemCellShowsOrderReadyCheck(state.orders, state.grid, itemId);
              const cellClasses = [
                "game-grid-cell relative flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden transition-colors duration-200",
                isBlocked
                  ? "cell-lock cursor-default"
                  : isBox
                    ? isHintBox
                      ? "cell-hint-box cursor-default"
                      : "cell-box cursor-default"
                    : isCobweb
                      ? "cell-cobweb cursor-default"
                      : `${isGen && genBlocked ? "cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "cell-selected" : isGen ? (genBlocked ? "cell-is-generator cell-generator-depleted" : "cell-is-generator") : isResPickup ? (resIsCoins ? "cell-resource-coins" : "cell-resource-energy") : "ds-cell-open"}`,
                mergePopIndex === index ? "cell-merge-pop" : "",
                isUnlockFlash ? (unlockFlashStrong ? "cell-unlocked cell-unlocked-strong" : "cell-unlocked") : "",
                isShaking ? "cell-shake" : "",
                isDragSource ? "opacity-45" : "",
                canDragFrom ? "touch-none select-none" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={index}
                  role="button"
                  data-grid-cell-index={index}
                  title={
                    isCobweb
                      ? isCobwebUnknownPlaceholder(cell)
                        ? "Скрыто, пока нет генератора этой комнаты на поле"
                        : "Под паутиной — сольите такой же предмет, чтобы снять"
                      : undefined
                  }
                  tabIndex={isBlocked || isCobweb ? -1 : 0}
                  aria-disabled={isBlocked || isCobweb}
                  onPointerDown={(e) => handleGridCellPointerDown(e, index, cell)}
                  onClick={(e) => {
                    if (suppressClickRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    onCellClick(index, e.shiftKey);
                  }}
                  onKeyDown={(e) => {
                    if (isBlocked || isCobweb) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCellClick(index, e.shiftKey);
                    }
                  }}
                  className={cellClasses}
                >
                  {isBox ? (
                    <>
                      <div className={`pointer-events-none absolute inset-0 z-[1] rounded-[5px] ${isHintBox ? "cell-hint-box" : "cell-box"}`} aria-hidden />
                      {isHintBox ? (
                        <span
                          className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-[9px] font-medium"
                          style={{ color: "var(--c-muted)" }}
                          aria-hidden
                        >
                          ?
                        </span>
                      ) : null}
                      {cell.boxIsGenerator ? (
                        <span
                          className="pointer-events-none absolute right-0.5 top-0.5 z-[2] text-[10px] leading-none drop-shadow-sm"
                          title="Здесь новый генератор"
                          aria-hidden
                        >
                          ⚡
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  {isCobweb ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-[2] rounded-[5px]"
                      style={{ background: "var(--c-fog)", opacity: 0.28 }}
                      aria-hidden
                    />
                  ) : null}
                  {coinFly?.source === "clean" && coinFly.cellIndex === index ? (
                    <span
                      className="coin-fly pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 -translate-x-1/2 whitespace-nowrap"
                      aria-hidden
                    >
                      +{coinFly.amount} 🍪
                    </span>
                  ) : null}
                  <div className="relative z-[5] flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="popLayout">
                      {item && (
                        <motion.span
                          key={`${index}-${cell.cellType}-${itemId}`}
                          initial={{
                            scale: 0,
                            opacity: 0,
                            rotate: 0,
                          }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ fontSize: emojiFontPx }}
                          className="pointer-events-none inline-flex select-none items-center justify-center leading-none"
                        >
                          {item.emoji}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {item && itemIsResourcePickup(item) ? (
                    <div
                      className="absolute bottom-0.5 right-0.5 z-10 rounded border px-0.5 text-[6px] font-medium tabular-nums text-white"
                      style={{
                        borderColor: "var(--c-peach2)",
                        background: item.grantsCoins > 0 ? "var(--c-golddark)" : "var(--c-bluedark)",
                      }}
                      title="Нажми, чтобы забрать"
                    >
                      {item.grantsCoins > 0 ? `+${item.grantsCoins}` : `+${item.grantsEnergy}`}
                    </div>
                  ) : item && !itemIsGenerator(item) && !itemIsResourcePickup(item) ? (
                    <div
                      className="absolute bottom-0.5 right-0.5 z-10 rounded px-0.5 text-[6px] font-medium tabular-nums"
                      style={{ background: "var(--c-cream)", color: "var(--c-muted)", border: "1px solid var(--c-peach2)" }}
                    >
                      L{isCobweb ? cell.itemLevel : item.level}
                    </div>
                  ) : null}
                  {showOrderReadyOnGrid ? (
                    <span
                      className="pointer-events-none absolute bottom-0.5 left-0.5 z-[11] flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white text-[8px] font-black text-white"
                      style={{ background: "#4CAF50" }}
                      aria-hidden
                      title="По заказам на поле хватает таких предметов"
                    >
                      ✓
                    </span>
                  ) : null}
                  {isGen ? (
                    <div
                      className="pointer-events-none absolute bottom-0.5 right-0.5 z-10 rounded px-0.5 text-[7px] font-medium leading-none tabular-nums text-white"
                      style={{ background: "var(--c-bluedark)" }}
                      title={genBlocked ? "Нужна энергия ⚡" : "Тап по генератору — создать предмет (−1 ⚡)"}
                    >
                      ⚡{state.energy}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!devMode && state.energy === 0 ? (
            <div
              className="absolute inset-0 z-[25] flex flex-col items-center justify-center rounded-[12px] px-3 text-center"
              style={{ background: "rgba(92, 61, 34, 0.55)" }}
            >
              <span className="mb-2 text-sm font-medium text-white">Энергия закончилась</span>
              <button type="button" onClick={onWatchAdEnergy} className="ds-btn-primary mb-2 max-w-[260px]">
                Смотреть рекламу → +{ENERGY_AD_REWARD} ⚡
              </button>
              <span className="max-w-[220px] text-[11px] font-medium leading-snug text-white/90">
                Или подождите: +1 энергии каждые 3 минуты
              </span>
            </div>
          ) : null}
          {dragGhost ? (
            <div
              aria-hidden
              className="pointer-events-none fixed z-[80] text-xl sm:text-2xl"
              style={{
                left: dragGhost.x,
                top: dragGhost.y,
                transform: "translate(-50%, -50%)",
              }}
            >
              {dragGhost.emoji}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 flex w-full shrink-0 items-center justify-end gap-2 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setSelectionInfoOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-btn)] border transition-transform active:scale-[0.97]"
          style={{
            borderColor: "var(--c-peach2)",
            background: "var(--c-cream)",
            color: "var(--c-rosedark)",
          }}
          aria-label="Информация о выделенной клетке"
          title="О выделенном предмете или генераторе (повторный клик по генератору — выдача)"
        >
          <CircleAlert className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={onOpenTutorial}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-btn)] border transition-transform active:scale-[0.97]"
          style={{
            borderColor: "var(--c-peach2)",
            background: "var(--c-cream)",
            color: "var(--c-muted)",
          }}
          aria-label="Справка по игре"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <GameSelectionInfoModal
        open={selectionInfoOpen}
        onClose={() => setSelectionInfoOpen(false)}
        selectedCell={selectedCell}
        grid={state.grid}
        progState={progState}
        energy={state.energy}
        maxEnergy={state.maxEnergy}
      />

      {isNoMoves ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4"
          aria-live="polite"
        >
          <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="no-moves-title"
            className="ds-card pointer-events-auto w-full max-w-[280px] p-5 text-center"
          >
            <h2 id="no-moves-title" className="mb-2 text-[15px] font-medium" style={{ color: "var(--c-browndark)" }}>
              Нет доступных ходов
            </h2>
            <p className="mb-4 text-[11px] font-medium leading-snug" style={{ color: "var(--c-brown)" }}>
              Сливайте одинаковые предметы, выполняйте заказы и используйте генератор (нужна энергия ⚡ и свободная
              клетка).
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={onNoMovesExitHome} className="ds-btn-secondary w-full">
                Выйти домой
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <MergeBurstParticles cellIndex={mergeBurstCellIndex} />
      </div>
    </div>
  );
}

export default function GameScreen(props: GameScreenProps) {
  return (
    <FieldDialogProvider>
      <GameScreenContent {...props} />
    </FieldDialogProvider>
  );
}
