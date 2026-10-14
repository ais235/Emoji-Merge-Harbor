/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from "react";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useUiScaling } from "../hooks/useUiScaling";
import { CircleAlert, Coins, HelpCircle } from "lucide-react";
import {
  ALL_ITEMS,
  ITEM_CHAINS,
  isCobwebUnknownPlaceholder,
  isBlockedCellType,
  isOpenCellType,
  itemIsGenerator,
  itemIsResourcePickup,
  gridCellSuppliesItemForOrder,
  itemCellShowsOrderReadyCheck,
  type GameState,
  type GridCell,
  type ProgressionState,
  type CoinFlyState,
} from "../types";
import { ROOM_GENERATOR_DEFS } from "../roomMergeCatalog";
import GameSelectionInfoModal from "../components/GameSelectionInfoModal";
import { FieldDialogProvider, useFieldDialog } from "../components/FieldDialogPanel";
import { getFieldLine } from "../fieldDialogs";
import { GameHeader } from "../components/GameHeader";
import OrderItemInfoModal from "../components/OrderItemInfoModal";
import MergeBurstParticles from "../components/MergeBurstParticles";
import { OrderCard } from "../components/OrderCard";
import { ItemIcon } from "../components/ItemIcon";
import { ENERGY_AD_REWARD } from "../gameBalance";

const GRID_DRAG_THRESHOLD_PX = 12;

function formatCooldown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** px-0.5 у ряда сетки + рамка p-1 + border ~1px с каждой стороны (горизонтальный «хром» вокруг клеток) */
const GRID_WRAP_CHROME_PX = 14;
/** Верхняя граница размера ячейки на очень широких портретах */
const GRID_CELL_MAX_PX = 58;
const GRID_GAP_PX = 2;

function computeGridCellSize(columnContentWidth: number, gridW: number): number {
  const usable = Math.max(120, columnContentWidth - GRID_WRAP_CHROME_PX);
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
  /** Новые генераторы: pop-анимация клетки при появлении на поле. */
  generatorAppearIndices?: number[];
  /** Поздравление и эмодзи-перелёт нового генератора в целевую клетку. */
  generatorUnlockFx?: { fxId: number; id: string; emoji: string; name: string; targetIndex: number } | null;
  onDismissGeneratorUnlockFx?: () => void;
  /** Усиленная вспышка (открытие ящика с генератором). */
  cellUnlockHeavyFlash?: boolean;
  cellShakePair: [number, number] | null;
  coinFly: CoinFlyState | null;
  /** Ячейка слияния — частицы в portal */
  mergeBurstCellIndex?: number | null;
  /** Клетка, куда предмет выпал без траты энергии (апгрейд «бесплатный спавн»). */
  freeSpawnFlashIndex?: number | null;
  gridWidth: number;
  gridHeight: number;
  isNoMoves: boolean;
  onNoMovesExitHome: () => void;
  /** Награда за рекламу: +энергия (через AbstractAdService). */
  onWatchAdEnergy: () => void;
  /** Сколько ещё ждать до следующей рекламы за энергию (мс); 0 — доступна. */
  energyAdCooldownMs: number;
  /** Редкие подсказки от Лены (покупка/новая комната). */
  lenaHint: { id: number; text: string } | null;
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
  generatorAppearIndices = [],
  generatorUnlockFx = null,
  onDismissGeneratorUnlockFx,
  cellUnlockHeavyFlash = false,
  cellShakePair,
  coinFly,
  mergeBurstCellIndex = null,
  freeSpawnFlashIndex = null,
  gridWidth,
  gridHeight,
  isNoMoves,
  onNoMovesExitHome,
  onWatchAdEnergy,
  energyAdCooldownMs,
  lenaHint,
}: GameScreenProps) {
  const [selectionInfoOpen, setSelectionInfoOpen] = useState(false);
  const [orderItemInfoId, setOrderItemInfoId] = useState<string | null>(null);
  const [cellSize, setCellSize] = useState(36);
  const { containerRef: gameColumnRef, scalingStyle } = useUiScaling();

  // Вычисляем размер ячейки по ширине колонки
  useLayoutEffect(() => {
    const el = gameColumnRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 16;
      const innerW = Math.max(0, el.clientWidth - padX);
      setCellSize(computeGridCellSize(innerW, gridWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridWidth, gameColumnRef]);

  const { showPanel } = useFieldDialog();
  const prevLevelForDialogRef = useRef(progState.level);
  const enteredRoomZoneRef = useRef<string | null>(null);
  const noMovesDialogShownRef = useRef(false);

  useEffect(() => {
    if (progState.level > prevLevelForDialogRef.current) {
      prevLevelForDialogRef.current = progState.level;
      const line = getFieldLine("level_up");
      if (line) {
        showPanel({
          npc: line.npc,
          emotion: "happy",
          text: line.text,
          duration: 4200,
        });
      }
    }
  }, [progState.level, showPanel]);

  useEffect(() => {
    const z = state.playZone;
    if (enteredRoomZoneRef.current === z) return;
    enteredRoomZoneRef.current = z;
    const line = getFieldLine("room_enter", z);
    if (line) {
      showPanel({
        npc: line.npc,
        emotion: "neutral",
        text: line.text,
        duration: 4500,
      });
    }
  }, [state.playZone, showPanel]);

  useEffect(() => {
    if (coinFly?.source !== "order") return;
    const line = getFieldLine("order_delivered");
    if (line) {
      showPanel({
        npc: line.npc,
        emotion: "happy",
        text: line.text,
        duration: 3400,
      });
    }
  }, [coinFly, showPanel]);

  const lastLenaHintIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lenaHint) return;
    if (lastLenaHintIdRef.current === lenaHint.id) return;
    lastLenaHintIdRef.current = lenaHint.id;
    showPanel({
      npc: "lena",
      emotion: "happy",
      text: lenaHint.text,
      duration: 5000,
    });
  }, [lenaHint, showPanel]);

  const generatorChainItems = (() => {
    if (!generatorUnlockFx) return [];
    const def = ROOM_GENERATOR_DEFS[generatorUnlockFx.id];
    const chain = def ? ITEM_CHAINS[def.spawnsChainId] : null;
    if (!chain) return [];
    return chain.items
      .filter((it) => "level" in it)
      .sort((a, b) => ("level" in a && "level" in b ? a.level - b.level : 0))
      .slice(0, 7);
  })();

  useEffect(() => {
    if (!isNoMoves) {
      noMovesDialogShownRef.current = false;
      return;
    }
    if (noMovesDialogShownRef.current) return;
    noMovesDialogShownRef.current = true;
    const line = getFieldLine("no_moves");
    if (line) {
      showPanel({
        npc: line.npc,
        emotion: "worried",
        text: line.text,
        duration: 5200,
      });
    }
  }, [isNoMoves, showPanel]);

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
    itemId: string | null;
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
          itemId: pid ?? null,
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
      className="app-desktop-bg-clear flex h-[100dvh] max-h-[100dvh] w-full items-start justify-center overflow-hidden font-sans select-none"
    >
      <div
        ref={gameColumnRef}
        className="relative box-border flex h-auto w-full max-w-[min(100%,var(--app-content-max))] flex-col bg-[var(--c-cream)] px-2 py-2"
        style={scalingStyle}
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
          totalOrdersCompleted={progState.totalOrdersCompleted}
          onGoHome={onGoHome}
        />
      </div>

      <div className="mb-1.5 w-full shrink-0">
        <div className="orders-row justify-start px-1.5 py-2">
          {state.orders.map((order) => (
            <OrderCard
              key={order.instanceId}
              orders={state.orders}
              order={order}
              grid={state.grid}
              showCoinFly={coinFly?.source === "order" && coinFly.orderId === order.id}
              coinFlyAmount={coinFly?.source === "order" && coinFly.orderId === order.id ? coinFly.amount : 0}
              onItemInfo={(id) => setOrderItemInfoId(id)}
              onDeliver={(id, inst, rect) => onCompleteOrder(id, inst, rect)}
            />
          ))}
        </div>
      </div>

      <OrderItemInfoModal
        open={orderItemInfoId != null}
        itemId={orderItemInfoId}
        onClose={() => setOrderItemInfoId(null)}
      />
      {generatorUnlockFx ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--c-peach2)] bg-[var(--c-cream)] p-4 shadow-2xl">
            <div className="mb-2 text-center text-[36px] leading-none">{generatorUnlockFx.emoji}</div>
            <h3 className="mb-1 text-center text-[16px] font-bold" style={{ color: "var(--c-browndark)" }}>
              Поздравляю! Новый генератор
            </h3>
            <p className="mb-3 text-center text-[13px] font-semibold" style={{ color: "var(--c-brown)" }}>
              {generatorUnlockFx.name}
            </p>
            <div className="mb-4 rounded-xl border border-[var(--c-peach2)] bg-white/70 px-2 py-2">
              <p className="mb-2 text-center text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
                Цепочка предметов генератора
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {generatorChainItems.map((it) => (
                  <div
                    key={it.id}
                    className="flex min-w-[48px] flex-col items-center rounded-lg border border-[var(--c-peach2)] bg-[var(--c-cream)] px-1.5 py-1"
                  >
                    <ItemIcon itemId={it.id} size={24} />
                    <span className="mt-0.5 text-[9px] font-medium" style={{ color: "var(--c-brown)" }}>
                      Ур. {it.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="ds-btn-primary w-full"
              onClick={() => onDismissGeneratorUnlockFx?.()}
            >
              Продолжить
            </button>
          </div>
        </div>
      ) : null}

      {/* Поле: квадратные ячейки по ширине. Всё поле масштабируется через uiScale */}
      <div className="flex w-full shrink-0 justify-center px-0.5 pb-1">
        <div className="flex shrink-0 items-center justify-center">
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
              const isGeneratorAppear = generatorAppearIndices.includes(index);
              const showFreeSpawnBadge = freeSpawnFlashIndex === index;
              const unlockFlashStrong = cellUnlockHeavyFlash && isUnlockFlash;
              const isGeneratorChest = isBox && cell.boxIsGenerator;
              const canDragFrom = cellAllowsGridDragSource(cell);
              const isGen = Boolean(item && itemIsGenerator(item));
              const genBlocked = isGen && state.energy <= 0;
              const resPickupDef = item && itemIsResourcePickup(item) ? item : null;
              const isResPickup = resPickupDef != null;
              const resIsCoins = resPickupDef != null && resPickupDef.grantsCoins > 0;
              const showOrderReadyOnGrid =
                Boolean(itemId && item) &&
                gridCellSuppliesItemForOrder(cell, itemId) &&
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
                isGeneratorChest ? "cell-generator-chest" : "",
                isGeneratorAppear ? "cell-generator-appear" : "",
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
                      {isGeneratorChest ? (
                        <span
                          className="pointer-events-none absolute left-0.5 top-0.5 z-[3] text-[11px] leading-none drop-shadow-sm"
                          title="Сундук с новым генератором"
                          aria-hidden
                        >
                          ✨⚡
                        </span>
                      ) : null}
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
                  {showFreeSpawnBadge ? (
                    <span
                      className="pointer-events-none absolute -top-1 left-1/2 z-[6] -translate-x-1/2 whitespace-nowrap rounded-full border border-[var(--c-peach2)] bg-[var(--c-cream)] px-1 text-[8px] font-bold"
                      style={{ color: "var(--c-greendark)" }}
                      aria-hidden
                    >
                      бесплатно
                    </span>
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
                      <span className="inline-flex items-center gap-1">
                        +{coinFly.amount}
                        <Coins className="h-3 w-3 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                      </span>
                    </span>
                  ) : null}
                  <div className="relative z-[5] flex items-center justify-center overflow-hidden">
                    <AnimatePresence mode="popLayout">
                      {item && itemId && (
                        <motion.span
                          key={`${index}-${cell.cellType}-${itemId}`}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="pointer-events-none inline-flex select-none items-center justify-center leading-none"
                        >
                          <ItemIcon itemId={itemId} size={Math.round(emojiFontPx * 1.25)} />
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
              <button
                type="button"
                onClick={onWatchAdEnergy}
                disabled={energyAdCooldownMs > 0}
                className={`mb-2 max-w-[260px] ${energyAdCooldownMs > 0 ? "ds-btn-secondary opacity-70" : "ds-btn-primary"}`}
              >
                {energyAdCooldownMs > 0
                  ? `Реклама через ${formatCooldown(energyAdCooldownMs)}`
                  : `Смотреть рекламу → +${ENERGY_AD_REWARD} ⚡`}
              </button>
              <span className="max-w-[220px] text-[11px] font-medium leading-snug text-white/90">
                Или подождите: +1 энергии каждые 3 минуты
              </span>
            </div>
          ) : null}
        </div>
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
      {dragGhost != null &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[80] text-xl sm:text-2xl"
            style={{
              left: dragGhost.x,
              top: dragGhost.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            {dragGhost.itemId ? (
              <ItemIcon itemId={dragGhost.itemId} size={40} />
            ) : (
              dragGhost.emoji
            )}
          </div>,
          document.body
        )}
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
