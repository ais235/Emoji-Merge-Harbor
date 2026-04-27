/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Coins, Star, CircleAlert, HelpCircle } from "lucide-react";
import {
  ALL_ITEMS,
  isCobwebUnknownPlaceholder,
  isBlockedCellType,
  isOpenCellType,
  itemIsGenerator,
  itemIsResourcePickup,
  orderCanDeliverFromGrid,
  orderRemainingForItem,
  type GameState,
  type GridCell,
  type Order,
  type ProgressionState,
  type CoinFlyState,
} from "../types";
import GameSelectionInfoModal from "../components/GameSelectionInfoModal";
import OrderItemInfoModal from "../components/OrderItemInfoModal";

/**
 * Один заказчик на заказ (эмодзи по роли).
 * Порядок: врач, студент, фермер, повар, механик, офисный работник, пилот, пожарный.
 */
const ORDER_CUSTOMER_EMOJIS = [
  "🧑‍⚕️",
  "🧑‍🎓",
  "🧑‍🌾",
  "🧑‍🍳",
  "🧑‍🔧",
  "🧑‍💼",
  "🧑‍✈️",
  "🧑‍🚒",
] as const;

function customerEmojiForOrder(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) {
    h = (Math.imul(31, h) + orderId.charCodeAt(i)) | 0;
  }
  const u = h >>> 0;
  return ORDER_CUSTOMER_EMOJIS[u % ORDER_CUSTOMER_EMOJIS.length];
}

/** На открытой клетке поля лежит экземпляр предмета из заказа. */
function orderItemOnOpenGrid(grid: GridCell[], itemId: string): boolean {
  return grid.some((c) => c.cellType === "item" && c.item === itemId);
}

/** Предмет ещё требуется хотя бы в одном заказе (остаток по слоту > 0). */
function mergeableItemNeededInOrders(orders: Order[], itemId: string): boolean {
  return orders.some((o) => orderRemainingForItem(o, itemId) > 0);
}

/** Есть ли у текущих заказов строка с этим itemId (для подсказки «сдано по заказу» на поле). */
function itemIdInAnyOrderRequirement(orders: Order[], itemId: string): boolean {
  return orders.some((o) => o.requirements.some((r) => r.itemId === itemId));
}

const GRID_DRAG_THRESHOLD_PX = 12;

/** max-w-md (28rem) — ширина колонки миниигры */
const GAME_MAX_INNER_WIDTH_PX = 448;
/** px-2 слева/справа у колонки игры */
const GAME_COLUMN_H_PAD_PX = 16;
/** p-1 слева/справа у рамки сетки */
const GRID_FRAME_H_PAD_PX = 8;
const GRID_GAP_PX = 4;

function computeGridCellSize(windowWidth: number, gridW: number): number {
  const usable =
    Math.min(windowWidth, GAME_MAX_INNER_WIDTH_PX) - GAME_COLUMN_H_PAD_PX - GRID_FRAME_H_PAD_PX;
  const raw = Math.floor((usable - (gridW - 1) * GRID_GAP_PX) / gridW);
  return Math.max(24, raw);
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
  onToggleDevMode: () => void;
  xpProgressPercent: number;
  onGoHome: () => void;
  onCellClick: (index: number, shiftKey?: boolean) => void;
  /** Слияние/обмен как второй шаг, но через перетаскивание с from на to. */
  onCellPairDrop: (from: number, to: number, shiftKey: boolean) => void;
  onCompleteOrder: (orderId: string, orderInstanceId: string) => void;
  onOpenTutorial: () => void;
  selectedCell: number | null;
  mergePopIndex: number | null;
  /** Краткая подсветка соседних клеток после снятия препятствия */
  cellUnlockedFlashIndices?: number[];
  cellShakePair: [number, number] | null;
  coinFly: CoinFlyState | null;
  gridWidth: number;
  gridHeight: number;
  totalOrdersCompleted: number;
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
  onCellPairDrop,
  onCompleteOrder,
  onOpenTutorial,
  selectedCell,
  mergePopIndex,
  cellUnlockedFlashIndices = [],
  cellShakePair,
  coinFly,
  gridWidth,
  gridHeight,
  totalOrdersCompleted,
  minigameOrdersCompletedAtRoom,
  maxMinigameOrdersAtRoom,
  ordersExhausted,
  nextRepairCost,
  playerCoins,
  onOrdersExhaustedGoHome,
  onSessionExitHome,
  isNoMoves,
  onNoMovesExitHome,
}: GameScreenProps) {
  const [selectionInfoOpen, setSelectionInfoOpen] = useState(false);
  const [orderItemInfoId, setOrderItemInfoId] = useState<string | null>(null);
  const [ordersDragging, setOrdersDragging] = useState(false);
  const [roomOrderBarFlash, setRoomOrderBarFlash] = useState(false);
  const prevRoomOrderRatioRef = useRef<number>(0);
  const [cellSize, setCellSize] = useState(() =>
    typeof window !== "undefined" ? computeGridCellSize(window.innerWidth, gridWidth) : 36
  );

  useEffect(() => {
    const calc = () => setCellSize(computeGridCellSize(window.innerWidth, gridWidth));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
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

  const ordersScrollRef = useRef<HTMLDivElement>(null);
  const ordersHorizDragRef = useRef<{ pointerId: number; startX: number; scrollLeft0: number } | null>(null);
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

  function onOrdersPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, textarea, select, [role='button']")
    ) {
      return;
    }
    const el = ordersScrollRef.current;
    if (!el) return;
    ordersHorizDragRef.current = { pointerId: e.pointerId, startX: e.clientX, scrollLeft0: el.scrollLeft };
    setOrdersDragging(true);
    el.setPointerCapture(e.pointerId);
  }

  function onOrdersPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = ordersHorizDragRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    if (e.cancelable) e.preventDefault();
    const el = ordersScrollRef.current;
    if (!el) return;
    const walk = (e.clientX - s.startX) * 1.5;
    el.scrollLeft = s.scrollLeft0 - walk;
  }

  function onOrdersPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = ordersHorizDragRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    ordersHorizDragRef.current = null;
    setOrdersDragging(false);
    ordersScrollRef.current?.releasePointerCapture(e.pointerId);
  }

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
    <div className="flex w-full min-h-[100dvh] justify-center bg-[#F8F9FA] font-sans select-none">
      <div className="relative flex w-full max-w-md flex-col px-2 py-2">
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

      <div className="mb-1 w-full min-w-0 flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          onClick={onGoHome}
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          ← Дом
        </button>
        <span className="text-[10px] font-bold text-gray-600 tabular-nums" title="Сколько заказов вы уже выполнили за всё время">
          Выполнено заказов: {totalOrdersCompleted}
        </span>
      </div>

      {/* Заказы: естественная высота карточек + горизонтальный скролл */}
      <div className="mb-1.5 w-full shrink-0 px-0 py-1">
        <div
          ref={ordersScrollRef}
          className="orders-scroll scroll-touch-x pb-1"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "x mandatory",
            cursor: ordersDragging ? "grabbing" : "grab",
          }}
          onPointerDown={onOrdersPointerDown}
          onPointerMove={onOrdersPointerMove}
          onPointerUp={onOrdersPointerUp}
          onPointerCancel={onOrdersPointerUp}
        >
          <div className="flex w-max flex-row items-stretch gap-2 px-1">
          {state.orders.map((order) => {
            const canDeliver = orderCanDeliverFromGrid(state.grid, order);
            const customerEmoji = customerEmojiForOrder(order.id);
            const reqs = order.requirements.slice(0, 3);
            return (
              <div
                key={order.instanceId}
                className={`flex shrink-0 flex-col rounded-xl border-2 bg-white p-2 shadow-sm transition-colors duration-150 ${canDeliver ? "border-green-400 bg-green-50/80" : "border-gray-200"}`}
                style={{
                  width: "140px",
                  flexShrink: 0,
                  scrollSnapAlign: "start",
                }}
              >
                <div className="mb-2 flex items-center justify-center border-b border-gray-100 pb-2">
                  <span className="text-4xl leading-none" aria-hidden title="Заказчик">
                    {customerEmoji}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                  {reqs.map((req) => {
                    const def = ALL_ITEMS[req.itemId];
                    const rem = orderRemainingForItem(order, req.itemId);
                    const rowDone = rem === 0;
                    const done = req.count - rem;
                    const onField = orderItemOnOpenGrid(state.grid, req.itemId);
                    return (
                      <button
                        key={req.itemId}
                        type="button"
                        onClick={() => setOrderItemInfoId(req.itemId)}
                        className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-2 bg-white text-2xl leading-none shadow-sm transition-transform active:scale-95 ${rowDone ? "border-green-400 opacity-55" : onField ? "border-sky-300 ring-1 ring-sky-200" : "border-amber-100 hover:border-amber-300"}`}
                        title="Подсказка по предмету"
                      >
                        <span aria-hidden>{def?.emoji ?? "❓"}</span>
                        {rowDone ? (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[10px] font-black text-white"
                            aria-hidden
                            title="По этой строке заказа всё сдано"
                          >
                            ✓
                          </span>
                        ) : onField ? (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-black text-white shadow-sm"
                            aria-hidden
                            title="Уже на поле — можно нажать «Отдать»"
                          >
                            ✓
                          </span>
                        ) : req.count > 1 ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[1.1rem] items-center justify-center rounded-full bg-gray-900 px-0.5 text-[8px] font-black text-white tabular-nums">
                            {done}/{req.count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex w-full items-center justify-between border-t border-gray-100 pt-2">
                  <div className="flex items-center gap-0.5">
                    <Coins className="h-3.5 w-3.5 text-yellow-600" />
                    <span className="text-[11px] font-bold tabular-nums text-yellow-800">{order.rewardCoins}</span>
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
                      onClick={() => onCompleteOrder(order.id, order.instanceId)}
                      disabled={!canDeliver}
                      className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${canDeliver ? "bg-green-500 text-white shadow-sm" : "cursor-not-allowed bg-gray-100 text-gray-400"}`}
                    >
                      Отдать
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {state.orders.length === 0 && ordersExhausted ? (
            <div
              className="flex flex-none flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center"
              style={{ width: 140, minHeight: 160, flexShrink: 0, scrollSnapAlign: "start" }}
            >
              <span className="text-2xl leading-none" aria-hidden>
                🏠
              </span>
              <span className="text-xs leading-tight text-amber-800">
                Отремонтируйте комнату, чтобы получить ещё задания
              </span>
              {nextRepairCost != null ? (
                <span className="text-xs font-bold text-yellow-700 tabular-nums">
                  🪙 {nextRepairCost}
                </span>
              ) : (
                <span className="text-[10px] text-amber-700/90">Все шаги ремонта в комнате куплены</span>
              )}
              <button
                type="button"
                className={`mt-0.5 rounded-lg px-2 py-1 text-xs font-bold shadow-sm ${
                  nextRepairCost != null && playerCoins >= nextRepairCost
                    ? "bg-green-500 text-white"
                    : nextRepairCost != null
                      ? "cursor-pointer bg-gray-300 text-gray-600"
                      : "bg-amber-400 text-white"
                }`}
                onClick={onOrdersExhaustedGoHome}
              >
                {nextRepairCost != null && playerCoins >= nextRepairCost
                  ? "Ремонтировать →"
                  : "В хаб →"}
              </button>
            </div>
          ) : null}
          </div>
        </div>
        {!ordersExhausted && maxMinigameOrdersAtRoom > 0 ? (
          <div className="w-full px-3 pb-1 pt-0.5">
            <div className="mb-0.5 flex justify-between text-[10px] text-gray-500">
              <span>Задания комнаты</span>
              <span className="tabular-nums text-gray-600">
                {minigameOrdersCompletedAtRoom}/{maxMinigameOrdersAtRoom}
              </span>
            </div>
            <div
              className={`h-1.5 w-full overflow-hidden rounded-full bg-gray-200 ${roomOrderBarFlash ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-white" : ""}`}
            >
              <motion.div
                className="h-full rounded-full bg-amber-400"
                initial={false}
                animate={{
                  width: `${Math.min(100, roomOrderRatio * 100)}%`,
                  opacity: roomOrderBarFlash ? [1, 0.65, 1] : 1,
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
        <div className="relative shrink-0 rounded-[1.25rem] border border-white bg-gray-200 p-1 shadow-inner">
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
              const isBox = cell.cellType === "box";
              const isCobweb = cell.cellType === "cobweb";
              const isBlocked = isBlockedCellType(cell.cellType);
              const isSelected = selectedCell === index;
              const isShaking =
                cellShakePair &&
                (cellShakePair[0] === index || cellShakePair[1] === index);
              const isDragSource = dragGhost?.from === index;
              const isUnlockFlash = cellUnlockedFlashIndices.includes(index);
              const canDragFrom = cellAllowsGridDragSource(cell);
              const isGen = Boolean(item && itemIsGenerator(item));
              const genBlocked = isGen && state.energy <= 0;
              const isResPickup = Boolean(item && itemIsResourcePickup(item));
              const resIsCoins = Boolean(isResPickup && item && item.grantsCoins > 0);
              const orderStillNeedsItem =
                Boolean(itemId) && mergeableItemNeededInOrders(state.orders, itemId);
              const inOrderReq = Boolean(itemId) && itemIdInAnyOrderRequirement(state.orders, itemId);
              const showOrderNeedCheckOnGrid =
                Boolean(itemId && item) &&
                cell.cellType === "item" &&
                !isGen &&
                !isResPickup &&
                orderStillNeedsItem;
              const showOrderLineDoneOnGrid =
                Boolean(itemId && item) &&
                cell.cellType === "item" &&
                !isGen &&
                !isResPickup &&
                inOrderReq &&
                !orderStillNeedsItem;
              const cellClasses = [
                "game-grid-cell relative flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-md transition-colors duration-200",
                isBox
                  ? "cell-box cursor-default"
                  : isCobweb
                    ? "cell-cobweb cursor-default"
                    : `${isGen && genBlocked ? "cursor-not-allowed" : "cursor-pointer"} ${isSelected ? "cell-selected bg-blue-50" : isGen ? (genBlocked ? "cell-is-generator cell-generator-depleted" : "cell-is-generator") : isResPickup ? (resIsCoins ? "cell-resource-coins" : "cell-resource-energy") : "bg-white/50 hover:bg-white/80"}`,
                mergePopIndex === index ? "cell-merge-pop" : "",
                isUnlockFlash ? "cell-unlocked" : "",
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
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] rounded-md bg-[#C4A882] shadow-[inset_0_0_0_2px_rgba(100,75,45,0.4)]"
                        aria-hidden
                      />
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
                      className="pointer-events-none absolute inset-0 z-[2] rounded-md bg-[repeating-linear-gradient(135deg,rgba(100,116,139,0.35)_0_4px,rgba(148,163,184,0.2)_4px_8px)]"
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
                          key={`${itemId}-${index}`}
                          initial={{
                            scale: 0,
                            opacity: 0,
                            rotate: 0,
                          }}
                          animate={{ scale: 1, opacity: 1, rotate: 0 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ fontSize: emojiFontPx }}
                          className={`pointer-events-none inline-flex select-none items-center justify-center leading-none ${
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
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {showOrderNeedCheckOnGrid ? (
                    <span
                      className="pointer-events-none absolute left-0.5 top-0.5 z-[11] flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-black text-white shadow-sm"
                      aria-hidden
                      title="Ещё нужен для заказа"
                    >
                      ✓
                    </span>
                  ) : showOrderLineDoneOnGrid ? (
                    <span
                      className="pointer-events-none absolute left-0.5 top-0.5 z-[11] flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[10px] font-black text-white shadow-sm"
                      aria-hidden
                      title="По заказам эта позиция уже закрыта — можно отдать другие"
                    >
                      ✓
                    </span>
                  ) : null}
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
                  ) : item && !itemIsGenerator(item) && !itemIsResourcePickup(item) ? (
                    <div className="absolute bottom-0.5 right-0.5 z-10 rounded bg-white/90 px-0.5 text-[6px] font-black text-gray-500 shadow-sm">
                      L{isCobweb ? cell.itemLevel : item.level}
                    </div>
                  ) : null}
                  {isGen ? (
                    <div
                      className="pointer-events-none absolute bottom-0.5 right-0.5 z-10 rounded bg-sky-600 px-0.5 text-[7px] font-black leading-none text-white shadow-sm tabular-nums"
                      title={genBlocked ? "Нужна энергия ⚡" : "Тап по генератору — создать предмет (−1 ⚡)"}
                    >
                      ⚡{state.energy}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {dragGhost ? (
            <div
              aria-hidden
              className="pointer-events-none fixed z-[80] text-xl sm:text-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
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
          className="flex-shrink-0 rounded-lg border border-gray-100 bg-white p-2.5 text-amber-600 shadow-sm transition-colors hover:bg-amber-50 hover:text-amber-700"
          aria-label="Информация о выделенной клетке"
          title="О выделенном предмете или генераторе (повторный клик по генератору — выдача)"
        >
          <CircleAlert className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={onOpenTutorial}
          className="flex-shrink-0 rounded-lg border border-gray-100 bg-white p-2.5 text-gray-400 shadow-sm transition-colors hover:text-blue-500"
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
        .cell-box {
          background: #c4a882;
        }
        .cell-cobweb {
          background: linear-gradient(165deg, rgba(248, 250, 252, 0.98), rgba(226, 232, 240, 0.92));
          box-shadow: inset 0 0 0 2px rgba(148, 163, 184, 0.35);
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

      {isNoMoves ? (
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
            <h2 id="no-moves-title" className="mb-2 text-lg font-black text-gray-900">
              Нет доступных ходов
            </h2>
            <p className="mb-4 text-xs text-gray-600">
              Сливайте одинаковые предметы, выполняйте заказы и используйте генератор (нужна энергия ⚡ и свободная
              клетка).
            </p>
            <div className="flex flex-col gap-2">
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
    </div>
  );
}
