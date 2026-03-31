/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Play, Star } from "lucide-react";
import {
  GameState,
  ALL_ITEMS,
  ITEM_CHAINS,
  Order,
  type OrderRequirement,
  orderIsFulfilled,
  findFirstCellIndexForOrderDelivery,
  ProgressionState,
  type AppScreen,
  type ActiveZone,
  type GridCell,
  type CoinFlyState,
  isObstacleCellState,
  itemIsGenerator,
  INITIAL_GENERATOR_CHARGES,
  cellGeneratorChargesRemaining,
  KEY_ITEM_ID,
  chainsEligibleForLootAndOrders,
  itemIsResourcePickup,
  COIN_PICKUP_ITEM_ID,
  ENERGY_PICKUP_ITEM_ID,
  GENERATOR_RESOURCE_DROP_CHANCE,
} from "./types";
import MainMenuScreen from "./screens/MainMenuScreen";
import CafeHubScreen from "./screens/CafeHubScreen";
import RoomScreen from "./screens/RoomScreen";
import GameScreen from "./screens/GameScreen";
import { ProgressionManager, EconomyManager, getGeneratorMaxCharges } from "./progressionManager";
import CoinShopModal from "./components/CoinShopModal";
import SettingsModal from "./components/SettingsModal";
import DialogModal from "./components/DialogModal";
import OnboardingOverlay from "./components/OnboardingOverlay";
import DailyBonusModal from "./components/DailyBonusModal";
import DailyScreen from "./screens/DailyScreen";
import {
  applyQuestProgress,
  loadDailyQuests,
  saveDailyQuests,
  getHomeQuestSummary,
  tryClaimDailyQuest,
  tryClaimWeekly,
  type DailyQuestsState,
  type QuestProgressType,
} from "./dailyQuests";
import { StoryEngine } from "./story/StoryEngine";
import { STORY_BEATS } from "./story/storyData";
import type { StoryBeat } from "./story/storyData";
import { initAudio, initSoundPreferenceFromStorage, isSoundMuted, setSoundMuted, sounds } from "./utils/sounds";
import { getNeighborIndices, pickEmptyCellForGeneratorSpawn } from "./utils/grid";
import { trySpawnLootOnDirtyOneClear } from "./utils/dirtyCleanSpawn";
import { hasEffectiveMoves } from "./utils/availableMoves";
import {
  defaultReconstructionState,
  getCurrentReconstructionStage,
  normalizeReconstructionState,
  tickReconstructionAfterOrderComplete,
  tryCompleteReconstructionItemsStage,
  tryDeliverReconstructionItem,
} from "./reconstruction";

const SHOWN_BEATS_KEY = "shownBeats";
const LAST_DAILY_BONUS_KEY = "lastDailyBonus";
const DAILY_STREAK_KEY = "dailyStreak";

const GRID_WIDTH = 7;
const GRID_HEIGHT = 9;
const MAX_GRID_CELLS = GRID_WIDTH * GRID_HEIGHT;
const INITIAL_ENERGY = 100;
/** 1 е. энергии каждые 10 с, пока energy ниже maxEnergy. */
const ENERGY_REGEN_INTERVAL_MS = 10_000;
/** Очистка грязи за монеты: dirty_2 → dirty_1, dirty_1 → normal. */
const COIN_CLEAN_DIRTY2_TO_DIRTY1 = 5;
const COIN_CLEAN_DIRTY1_TO_NORMAL = 10;
/** Цель сессии на поле: число сданных заказов до «победы». */
const SESSION_ORDER_GOAL = 5;

/** Стартовая энергия при новой игре, если в UI включён dev mode (сохранения не трогаем). */
const DEV_RESET_ENERGY = 999;

const STORAGE_KEY = "emoji_merge_harbor_state_v2"; // Changed key to avoid old state issues

function createNormalEmptyGridCell(): GridCell {
  return { item: null, cellState: "normal" };
}

/** Одна корзина-генератор в первой свободной обычной клетке (новая сетка / сессия). */
function placeInitialGenerator(grid: GridCell[]): GridCell[] {
  const next = grid.map((c) => ({ ...c }));
  const i = next.findIndex((c) => c.item === null && c.cellState === "normal");
  if (i >= 0) {
    next[i] = {
      ...next[i],
      item: "basket_generator",
      generatorCharges: INITIAL_GENERATOR_CHARGES,
    };
  }
  return next;
}

/** После обмена предметами между клетками — корректные `generatorCharges`. */
function gridCellAfterPlacingItem(
  targetCell: GridCell,
  newItem: string | null,
  sourceCell: GridCell,
  generatorMaxCharges: number
): GridCell {
  if (!newItem) {
    return { item: null, cellState: targetCell.cellState };
  }
  const d = ALL_ITEMS[newItem];
  if (d && itemIsGenerator(d)) {
    return {
      ...targetCell,
      item: newItem,
      generatorCharges: cellGeneratorChargesRemaining(sourceCell, generatorMaxCharges),
    };
  }
  return { ...targetCell, item: newItem, generatorCharges: undefined };
}

function gridHasGenerator(grid: GridCell[]): boolean {
  return grid.some((c) => {
    if (!c.item) return false;
    const d = ALL_ITEMS[c.item];
    return Boolean(d && itemIsGenerator(d));
  });
}

/** Старые сохранения без генератора: одна корзина, чтобы не остаться без спавна. */
function ensureGeneratorOnGrid(grid: GridCell[]): GridCell[] {
  if (gridHasGenerator(grid)) return grid;
  return placeInitialGenerator(grid.map((c) => ({ ...c })));
}

/** Только для теста: при новой игре N случайных ячеек — препятствие dirty_2 (загрузка из storage не трогается). */
const TEST_RANDOM_DIRTY2_CELL_COUNT = 3;

function applyTestRandomDirty2Cells(grid: GridCell[]): GridCell[] {
  const next = grid.map((c) => ({ ...c }));
  const picks = new Set<number>();
  const target = Math.min(TEST_RANDOM_DIRTY2_CELL_COUNT, next.length);
  while (picks.size < target) {
    picks.add(Math.floor(Math.random() * next.length));
  }
  picks.forEach((i) => {
    next[i] = { ...next[i], cellState: "dirty_2" };
  });
  return next;
}

/** Тест: несколько пустых normal-клеток становятся locked (ключ на поле выдаётся отдельно). */
const TEST_RANDOM_LOCKED_CELL_COUNT = 2;

function applyTestRandomLockedCells(grid: GridCell[]): GridCell[] {
  const next = grid.map((c) => ({ ...c }));
  const candidates: number[] = [];
  for (let i = 0; i < next.length; i++) {
    if (next[i].cellState === "normal" && next[i].item === null) {
      candidates.push(i);
    }
  }
  const n = Math.min(TEST_RANDOM_LOCKED_CELL_COUNT, candidates.length);
  const picks = new Set<number>();
  while (picks.size < n) {
    picks.add(candidates[Math.floor(Math.random() * candidates.length)]!);
  }
  picks.forEach((i) => {
    next[i] = { ...next[i], cellState: "locked" };
  });
  return next;
}

function placeInitialKey(grid: GridCell[]): GridCell[] {
  const next = grid.map((c) => ({ ...c }));
  const i = next.findIndex((c) => c.item === null && c.cellState === "normal");
  if (i >= 0) {
    next[i] = { ...next[i], item: KEY_ITEM_ID };
  }
  return next;
}

function buildFreshPlayGrid(): GridCell[] {
  return placeInitialKey(
    placeInitialGenerator(
      applyTestRandomLockedCells(
        applyTestRandomDirty2Cells(
          Array.from({ length: MAX_GRID_CELLS }, () => createNormalEmptyGridCell())
        )
      )
    )
  );
}

function normalizeGridFromStorage(rawGrid: unknown, expectedLen: number): GridCell[] | null {
  if (!Array.isArray(rawGrid) || rawGrid.length !== expectedLen) return null;
  return rawGrid.map((entry): GridCell => {
    if (entry !== null && typeof entry === "object" && "item" in entry) {
      const o = entry as Record<string, unknown>;
      const rawItem = o.item;
      const item =
        rawItem === null ? null : typeof rawItem === "string" ? rawItem : null;
      let cellState: GridCell["cellState"] = "normal";
      const raw = o.cellState;
      if (raw === "normal" || raw === "dirty_1" || raw === "dirty_2" || raw === "locked") {
        cellState = raw;
      } else if (raw === "blocked") {
        cellState = "dirty_2";
      }
      const rawCh = o.generatorCharges;
      const parsedCharges =
        typeof rawCh === "number" && Number.isFinite(rawCh) ? Math.max(0, Math.floor(rawCh)) : undefined;
      const base: GridCell = { item, cellState };
      if (item) {
        const d = ALL_ITEMS[item];
        if (d && itemIsGenerator(d)) {
          base.generatorCharges =
            parsedCharges !== undefined ? parsedCharges : INITIAL_GENERATOR_CHARGES;
        }
      }
      return base;
    }
    if (entry === null || typeof entry === "string") {
      const legacyItem = entry === null ? null : entry;
      const base: GridCell = { item: legacyItem, cellState: "normal" };
      if (legacyItem) {
        const d = ALL_ITEMS[legacyItem];
        if (d && itemIsGenerator(d)) {
          base.generatorCharges = INITIAL_GENERATOR_CHARGES;
        }
      }
      return base;
    }
    return createNormalEmptyGridCell();
  });
}

function createInitialOrders(): Order[] {
  const baseM = EconomyManager.calculateOrderReward("medium");
  const baseS = EconomyManager.calculateOrderReward("simple");
  const mult1 = 1 + 0.25 * (3 - 1) + 0.1 * (2 - 1); /* 2×f2 + 1×f3 */
  const mult2 = 1 + 0.25 * (2 - 1); /* 2×s2 */
  return [
    {
      id: "o1",
      requirements: [
        { itemId: "f2", count: 2 },
        { itemId: "f3", count: 1 },
      ],
      delivered: {},
      rewardCoins: Math.round(baseM.coins * mult1),
      rewardXp: Math.round(baseM.xp * mult1),
    },
    {
      id: "o2",
      requirements: [{ itemId: "s2", count: 2 }],
      delivered: {},
      rewardCoins: Math.round(baseS.coins * mult2),
      rewardXp: Math.round(baseS.xp * mult2),
    },
  ];
}

function normalizeOrdersFromStorage(raw: unknown[]): Order[] {
  const out: Order[] = [];
  for (const o of raw) {
    const norm = normalizeOneOrder(o);
    if (norm) out.push(norm);
  }
  return out;
}

function normalizeOneOrder(o: unknown): Order | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const rewardCoins = typeof r.rewardCoins === "number" ? r.rewardCoins : 15;
  const rewardXp = typeof r.rewardXp === "number" ? r.rewardXp : 10;

  let requirements: OrderRequirement[];
  if (Array.isArray(r.requirements)) {
    requirements = r.requirements
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const q = x as Record<string, unknown>;
        const itemId = typeof q.itemId === "string" ? q.itemId : null;
        const count = typeof q.count === "number" && q.count >= 1 ? Math.floor(q.count) : null;
        if (!itemId || !count) return null;
        return { itemId, count };
      })
      .filter((x): x is OrderRequirement => x !== null);
    if (requirements.length === 0) return null;
  } else if (typeof r.requiredItemId === "string") {
    requirements = [{ itemId: r.requiredItemId, count: 1 }];
  } else {
    return null;
  }

  let delivered: Partial<Record<string, number>> = {};
  if (r.delivered && typeof r.delivered === "object" && !Array.isArray(r.delivered)) {
    for (const [k, v] of Object.entries(r.delivered as Record<string, unknown>)) {
      if (typeof v === "number" && v >= 1) delivered[k] = Math.floor(v);
    }
  }

  for (const req of requirements) {
    const d = delivered[req.itemId] ?? 0;
    if (d > req.count) delivered[req.itemId] = req.count;
  }

  return { id, requirements, delivered, rewardCoins, rewardXp };
}

function hydrateGameStateFromStorage(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const grid = normalizeGridFromStorage(g.grid, MAX_GRID_CELLS);
  if (!grid) return null;
  return {
    grid: ensureGeneratorOnGrid(grid),
    energy: typeof g.energy === "number" ? g.energy : INITIAL_ENERGY,
    maxEnergy: typeof g.maxEnergy === "number" ? g.maxEnergy : INITIAL_ENERGY,
    orders: (() => {
      const raw = Array.isArray(g.orders) ? normalizeOrdersFromStorage(g.orders) : [];
      return raw.length > 0 ? raw : createInitialOrders();
    })(),
    isFirstLaunch: g.isFirstLaunch !== false,
  };
}

/** Валидное сохранение в localStorage (игровое состояние + прогрессия). */
function isValidPersistedSave(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const p = parsed as Record<string, unknown>;
  if (!p.gameState || !p.progState || typeof p.progState !== "object") return false;
  const pr = p.progState as Record<string, unknown>;
  if (typeof pr.level !== "number" || typeof pr.coins !== "number" || typeof pr.xp !== "number") {
    return false;
  }
  if (pr.unlockedZones !== undefined && !Array.isArray(pr.unlockedZones)) return false;
  if (pr.purchasedUpgrades !== undefined && !Array.isArray(pr.purchasedUpgrades)) return false;
  return hydrateGameStateFromStorage(p.gameState) !== null;
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [progState, setProgState] = useState<ProgressionState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLevelUpFlash, setShowLevelUpFlash] = useState(false);
  const [showOrderCoinBonus, setShowOrderCoinBonus] = useState(false);
  /** Разработка: без ограничений энергии там, где она ещё используется. */
  const [devMode, setDevMode] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("menu");
  const [activeZone, setActiveZone] = useState<ActiveZone>("hall");
  const [lastAction, setLastAction] = useState<{ type: "merge" | "spawn" | "order", index?: number } | null>(null);
  const [currentBeat, setCurrentBeat] = useState<StoryBeat | null>(null);
  const [shownBeats, setShownBeats] = useState<string[]>([]);
  const [ordersCompleted, setOrdersCompleted] = useState(0);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [dailyBonusDay, setDailyBonusDay] = useState(1);
  const [dailyQuests, setDailyQuests] = useState<DailyQuestsState>(() => loadDailyQuests());
  const [cellMergePopIndex, setCellMergePopIndex] = useState<number | null>(null);
  /** Индексы соседей, только что очищенных от препятствия после merge (краткая анимация). */
  const [cellUnlockedFlashIndices, setCellUnlockedFlashIndices] = useState<number[]>([]);
  /** Краткая анимация появления лута при очистке dirty_1 → normal. */
  const [cellDirtyLootFlashIndices, setCellDirtyLootFlashIndices] = useState<number[]>([]);
  const [cellShakePair, setCellShakePair] = useState<[number, number] | null>(null);
  const [coinFly, setCoinFly] = useState<CoinFlyState | null>(null);
  /** Нет эффективных ходов (слияние / заказ / спавн при энергии); UI мягкий, ввод не блокируем. */
  const [isNoMoves, setIsNoMoves] = useState(false);
  const [sessionOrdersCompleted, setSessionOrdersCompleted] = useState(0);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  /** Режим: клик по грязной клетке тратит монеты на очистку (без Shift). */
  const [paidCleanMode, setPaidCleanMode] = useState(false);
  const [purchaseSparkleNonce, setPurchaseSparkleNonce] = useState(0);
  const [coinShopOpen, setCoinShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Была успешная загрузка из STORAGE_KEY при старте приложения. */
  const [saveLoadedFromDisk, setSaveLoadedFromDisk] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [screenEntering, setScreenEntering] = useState(false);
  const skipScreenTransitionRef = useRef(true);

  const triggerLevelUp = useCallback(() => {
    sounds.levelUp();
    setShowLevelUpFlash(true);
    window.setTimeout(() => {
      setShowLevelUpFlash(false);
      setShowLevelUp(true);
      window.setTimeout(() => setShowLevelUp(false), 2000);
    }, 500);
  }, []);

  const handleToggleDevMode = useCallback(() => {
    setDevMode((wasOn) => {
      if (wasOn && state && progState) {
        const bonuses = new ProgressionManager(progState).getActiveBonuses();
        const normalMax = INITIAL_ENERGY + bonuses.energy_max;
        setState((s) => (s ? { ...s, maxEnergy: normalMax, energy: normalMax } : s));
      }
      return !wasOn;
    });
  }, [state, progState]);

  /** Только новая сетка (перемешать); заказы, энергия, прогресс сессии заказов — без изменений. */
  const handleShuffleGrid = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        grid: buildFreshPlayGrid(),
      };
    });
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellDirtyLootFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  /** Новая сессия на поле: сетка и счётчик заказов; монеты и уровень не трогаем. */
  const handleSessionNewGame = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        grid: buildFreshPlayGrid(),
        orders: createInitialOrders(),
      };
    });
    setSessionOrdersCompleted(0);
    setIsSessionComplete(false);
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellDirtyLootFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  const handleSessionExitHome = useCallback(() => {
    setIsSessionComplete(false);
    setSessionOrdersCompleted(0);
    setShowTutorial(false);
    setCurrentScreen("hub");
  }, []);

  const handleNoMovesExitHome = useCallback(() => {
    setShowTutorial(false);
    setCurrentScreen("hub");
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellDirtyLootFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  /** Победа сессии не показывает «нет ходов». Иначе — нет слияний, заказов и выдачи с генератора. */
  useEffect(() => {
    if (!state || !progState || currentScreen !== "game") {
      setIsNoMoves(false);
      return;
    }
    if (isSessionComplete) {
      setIsNoMoves(false);
      return;
    }
    const genMax = getGeneratorMaxCharges(progState.purchasedUpgrades);
    setIsNoMoves(!hasEffectiveMoves(state.grid, state.orders, state.energy, genMax));
  }, [state, progState, currentScreen, isSessionComplete]);

  useEffect(() => {
    if (currentScreen !== "game") setPaidCleanMode(false);
  }, [currentScreen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((s) => {
        if (!s || s.energy >= s.maxEnergy) return s;
        const next = s.energy + 1;
        console.log("[energy] regen +1 →", next, "/", s.maxEnergy);
        return { ...s, energy: next };
      });
    }, ENERGY_REGEN_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const resetGame = () => {
    const startEnergy = devMode ? DEV_RESET_ENERGY : INITIAL_ENERGY;
    const initialProgState: ProgressionState = {
      level: 1,
      xp: 0,
      coins: 0,
      unlockedZones: ["hall"],
      purchasedUpgrades: [],
      reconstruction: defaultReconstructionState(),
    };
    const initialGameState: GameState = {
      grid: buildFreshPlayGrid(),
      energy: startEnergy,
      maxEnergy: startEnergy,
      orders: createInitialOrders(),
      isFirstLaunch: true,
    };
    setProgState(initialProgState);
    setState(initialGameState);
    setIsNoMoves(false);
    setSessionOrdersCompleted(0);
    setIsSessionComplete(false);
    setPaidCleanMode(false);
    setShowTutorial(false);
    setCurrentScreen("menu");
    setActiveZone("hall");
    setShownBeats([]);
    setOrdersCompleted(0);
    setCurrentBeat(null);
    try {
      localStorage.setItem(SHOWN_BEATS_KEY, "[]");
    } catch {
      /* ignore */
    }
    if (initialGameState.isFirstLaunch) setShowTutorial(false);
  };

  const handleFullReset = useCallback(() => {
    if (!window.confirm("Ты уверен? Весь прогресс и сохранения будут удалены.")) return;
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, []);

  // Initialize or load state
  useEffect(() => {
    try {
      let sb: string[] = [];
      const rawShown = localStorage.getItem(SHOWN_BEATS_KEY);
      if (rawShown) {
        const p = JSON.parse(rawShown);
        if (Array.isArray(p)) sb = p.filter((x): x is string => typeof x === "string");
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidPersistedSave(parsed)) {
          const hydrated = hydrateGameStateFromStorage(
            (parsed as { gameState: unknown }).gameState
          )!;
          setSaveLoadedFromDisk(true);
          setState(hydrated);
          const rawProg = (parsed as { progState: ProgressionState }).progState;
          setProgState({
            ...rawProg,
            reconstruction: normalizeReconstructionState(
              rawProg.reconstruction as unknown
            ),
          });
          setOrdersCompleted(
            typeof (parsed as { ordersCompleted?: unknown }).ordersCompleted === "number"
              ? (parsed as { ordersCompleted: number }).ordersCompleted
              : 0
          );
          setShownBeats(sb);
          const streak = Number(localStorage.getItem(DAILY_STREAK_KEY) || "1");
          setDailyBonusDay(Math.min(7, Math.max(1, streak)));
          return;
        }
      }
      setSaveLoadedFromDisk(false);
      resetGame();
    } catch (e) {
      console.error("Failed to load state:", e);
      setSaveLoadedFromDisk(false);
      resetGame();
    }
  }, []);

  // Save state on change
  useEffect(() => {
    if (state && progState) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ gameState: state, progState, ordersCompleted })
        );
      } catch (e) {
        console.error("Failed to save state:", e);
      }
    }
  }, [state, progState, ordersCompleted]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOWN_BEATS_KEY, JSON.stringify(shownBeats));
    } catch {
      /* ignore */
    }
  }, [shownBeats]);

  useEffect(() => {
    saveDailyQuests(dailyQuests);
  }, [dailyQuests]);

  useEffect(() => {
    initSoundPreferenceFromStorage();
    setSoundOn(!isSoundMuted());
  }, []);

  useEffect(() => {
    const onFirst = () => initAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

  useLayoutEffect(() => {
    if (skipScreenTransitionRef.current) {
      skipScreenTransitionRef.current = false;
      return;
    }
    setScreenEntering(true);
    const t = window.setTimeout(() => setScreenEntering(false), 200);
    return () => window.clearTimeout(t);
  }, [currentScreen]);

  const updateQuestProgress = useCallback((type: QuestProgressType, amount: number) => {
    setDailyQuests((d) => applyQuestProgress(d, type, amount));
  }, []);

  /** Автоочередь сюжета — только на экране игры (не поверх главного меню). */
  useEffect(() => {
    if (!progState || currentScreen !== "game") return;
    setCurrentBeat((cur) => {
      if (cur) return cur;
      const next = new StoryEngine(shownBeats).getNextBeat(progState, ordersCompleted);
      return next ?? null;
    });
  }, [progState, shownBeats, ordersCompleted, currentScreen]);

  useEffect(() => {
    if (currentScreen !== "hub" || !progState) return;
    const last = localStorage.getItem(LAST_DAILY_BONUS_KEY);
    const now = Date.now();
    const eligible =
      !last || now - Number(last) > 20 * 60 * 60 * 1000;
    if (eligible) {
      const streak = Number(localStorage.getItem(DAILY_STREAK_KEY) || "1");
      setDailyBonusDay(Math.min(7, Math.max(1, streak)));
      setShowDailyBonus(true);
    }
  }, [currentScreen, progState]);

  const handleBackToMainMenu = useCallback(() => {
    setCoinShopOpen(false);
    setCurrentScreen("menu");
  }, []);

  const generateNewOrder = (level: number): Order => {
    const chains = chainsEligibleForLootAndOrders();
    const maxItemLevel = Math.min(level + 1, 7);
    const typeCount =
      level <= 2 ? 1 : level <= 4 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);

    const requirements: OrderRequirement[] = [];
    for (let t = 0; t < typeCount; t++) {
      const randomChain = chains[Math.floor(Math.random() * chains.length)];
      const randomLevel = Math.floor(Math.random() * maxItemLevel) + 1;
      const item = randomChain.items[randomLevel - 1];
      const countBase = randomLevel <= 2 ? 1 + Math.floor(Math.random() * 2) : 1;
      const countExtra = level >= 5 && Math.random() < 0.35 ? 1 : 0;
      const count = countBase + countExtra;
      const ex = requirements.find((q) => q.itemId === item.id);
      if (ex) ex.count += count;
      else requirements.push({ itemId: item.id, count });
    }

    const maxReqLevel = Math.max(
      ...requirements.map((req) => {
        const d = ALL_ITEMS[req.itemId];
        return d && "level" in d ? d.level : 1;
      })
    );
    const difficulty = maxReqLevel < 3 ? "simple" : maxReqLevel < 5 ? "medium" : "hard";
    const base = EconomyManager.calculateOrderReward(difficulty);
    const totalUnits = requirements.reduce((s, q) => s + q.count, 0);
    const mult = 1 + 0.25 * (totalUnits - 1) + 0.1 * (requirements.length - 1);
    const rewardCoins = Math.round(base.coins * mult);
    const rewardXp = Math.round(base.xp * mult);

    return {
      id: Math.random().toString(36).slice(2, 11),
      requirements,
      delivered: {},
      rewardCoins,
      rewardXp,
    };
  };

  const handleCellClick = (index: number, shiftKey = false) => {
    if (!state || !progState || isSessionComplete) return;

    const playBonuses = new ProgressionManager(progState).getActiveBonuses();
    const genMax = getGeneratorMaxCharges(progState.purchasedUpgrades);

    const cell = state.grid[index];
    const wantsPaidClean = shiftKey || paidCleanMode;

    if (cell.cellState === "locked") {
      if (selectedCell === null) return;
      if (selectedCell === index) {
        setSelectedCell(null);
        return;
      }
      const srcCell = state.grid[selectedCell];
      if (isObstacleCellState(srcCell.cellState)) return;
      if (srcCell.item === KEY_ITEM_ID) {
        const newGrid = [...state.grid];
        newGrid[index] = { ...newGrid[index], cellState: "normal" };
        newGrid[selectedCell] = { item: null, cellState: newGrid[selectedCell].cellState };
        setState({ ...state, grid: newGrid });
        setSelectedCell(null);
        sounds.purchase();
        return;
      }
      setCellShakePair([selectedCell, index]);
      window.setTimeout(() => setCellShakePair(null), 300);
      setSelectedCell(null);
      return;
    }

    if (
      wantsPaidClean &&
      (cell.cellState === "dirty_1" || cell.cellState === "dirty_2")
    ) {
      const cost =
        cell.cellState === "dirty_2" ? COIN_CLEAN_DIRTY2_TO_DIRTY1 : COIN_CLEAN_DIRTY1_TO_NORMAL;
      if (progState.coins < cost) return;

      const manager = new ProgressionManager(progState);
      manager.addCoins(-cost);
      setProgState(manager.getState());

      const newGrid = [...state.grid];
      if (cell.cellState === "dirty_2") {
        newGrid[index] = { ...newGrid[index], cellState: "dirty_1" };
      } else {
        newGrid[index] = { ...newGrid[index], cellState: "normal" };
        const lootAt = trySpawnLootOnDirtyOneClear(
          newGrid,
          index,
          GRID_WIDTH,
          GRID_HEIGHT,
          playBonuses.dirty_drop_chance
        );
        if (lootAt !== null) {
          setCellDirtyLootFlashIndices([lootAt]);
          window.setTimeout(() => setCellDirtyLootFlashIndices([]), 480);
          sounds.select();
        }
      }
      setState({ ...state, grid: newGrid });
      setSelectedCell(null);
      setCellUnlockedFlashIndices([index]);
      window.setTimeout(() => setCellUnlockedFlashIndices([]), 300);
      sounds.purchase();
      return;
    }

    // Препятствия dirty_1 / dirty_2: без режима очистки / Shift — клик игнорируется.
    if (isObstacleCellState(cell.cellState)) return;

    if (selectedCell === null) {
      const clickedId = state.grid[index].item;
      if (clickedId !== null) {
        const itemDef = ALL_ITEMS[clickedId];
        if (itemDef && itemIsResourcePickup(itemDef) && !isObstacleCellState(cell.cellState)) {
          const newGrid = [...state.grid];
          newGrid[index] = { item: null, cellState: newGrid[index].cellState };
          if (itemDef.grantsCoins > 0) {
            const manager = new ProgressionManager(progState);
            manager.addCoins(itemDef.grantsCoins);
            setProgState(manager.getState());
            updateQuestProgress("coins", itemDef.grantsCoins);
          }
          const nextEnergy =
            itemDef.grantsEnergy > 0
              ? Math.min(state.maxEnergy, state.energy + itemDef.grantsEnergy)
              : state.energy;
          setState({ ...state, grid: newGrid, energy: nextEnergy });
          setSelectedCell(null);
          sounds.select();
          return;
        }
        if (
          itemDef &&
          itemIsGenerator(itemDef) &&
          !isObstacleCellState(cell.cellState)
        ) {
          const remaining = cellGeneratorChargesRemaining(cell, genMax);
          if (remaining <= 0) return;

          const spawnIdx = pickEmptyCellForGeneratorSpawn(
            state.grid,
            index,
            GRID_WIDTH,
            GRID_HEIGHT
          );
          if (spawnIdx === null) return;
          const chain = ITEM_CHAINS[itemDef.spawnsChainId];
          const lvl1 = chain?.items[0];
          if (!lvl1) return;

          let spawnItemId = lvl1.id;
          if (Math.random() < GENERATOR_RESOURCE_DROP_CHANCE) {
            spawnItemId = Math.random() < 0.5 ? COIN_PICKUP_ITEM_ID : ENERGY_PICKUP_ITEM_ID;
          }

          const newGrid = [...state.grid];
          newGrid[spawnIdx] = {
            ...newGrid[spawnIdx],
            item: spawnItemId,
            generatorCharges: undefined,
          };
          const freeRoll = Math.random() < playBonuses.free_spawn_chance;
          const nextCharges = freeRoll ? remaining : remaining - 1;
          newGrid[index] = { ...newGrid[index], generatorCharges: nextCharges };
          setState({ ...state, grid: newGrid });
          setLastAction({ type: "spawn", index: spawnIdx });
          sounds.select();
          return;
        }
        sounds.select();
        setSelectedCell(index);
      }
    } else {
      if (selectedCell === index) {
        setSelectedCell(null);
      } else {
        const itemAId = state.grid[selectedCell].item;
        const itemBId = state.grid[index].item;

        if (itemAId && itemBId && itemAId === itemBId) {
          const itemDef = ALL_ITEMS[itemAId];
          if (itemIsGenerator(itemDef) || itemIsResourcePickup(itemDef)) {
            setCellShakePair([selectedCell, index]);
            window.setTimeout(() => setCellShakePair(null), 300);
            setSelectedCell(null);
            return;
          }
          const chain = ITEM_CHAINS[itemDef.chain];
          const nextItem = chain.items[itemDef.level];

          if (nextItem) {
            const newGrid = [...state.grid];
            newGrid[selectedCell] = { item: null, cellState: newGrid[selectedCell].cellState };
            newGrid[index] = { ...newGrid[index], item: nextItem.id, generatorCharges: undefined };

            const unlockedNeighborIndices: number[] = [];
            const dirtyLootSpawnCells: number[] = [];
            let cleaningReward = 0;
            for (const ni of getNeighborIndices(index, GRID_WIDTH, GRID_HEIGHT)) {
              const cs = newGrid[ni].cellState;
              if (cs === "dirty_2") {
                newGrid[ni] = { ...newGrid[ni], cellState: "dirty_1" };
                unlockedNeighborIndices.push(ni);
                cleaningReward += 1;
              } else if (cs === "dirty_1") {
                newGrid[ni] = { ...newGrid[ni], cellState: "normal" };
                unlockedNeighborIndices.push(ni);
                cleaningReward += 3;
                const lootAt = trySpawnLootOnDirtyOneClear(
                  newGrid,
                  ni,
                  GRID_WIDTH,
                  GRID_HEIGHT,
                  playBonuses.dirty_drop_chance
                );
                if (lootAt !== null) dirtyLootSpawnCells.push(lootAt);
              }
            }

            const manager = new ProgressionManager(progState);
            const { leveledUp } = manager.addXp(itemDef.level);
            if (cleaningReward > 0) {
              manager.addCoins(cleaningReward);
              console.log("[merge] dirty clean reward:", cleaningReward, "coins");
            }
            const newProg = manager.getState();

            if (leveledUp) {
              triggerLevelUp();
            }

            setProgState(newProg);
            setState({
              ...state,
              grid: newGrid,
              energy: leveledUp ? state.maxEnergy : state.energy,
            });
            setSelectedCell(null);
            setLastAction({ type: "merge", index });
            updateQuestProgress("merge", 1);
            sounds.merge();
            setCellMergePopIndex(index);
            window.setTimeout(() => setCellMergePopIndex(null), 350);
            if (unlockedNeighborIndices.length > 0) {
              setCellUnlockedFlashIndices(unlockedNeighborIndices);
              window.setTimeout(() => setCellUnlockedFlashIndices([]), 300);
            }
            if (dirtyLootSpawnCells.length > 0) {
              setCellDirtyLootFlashIndices(dirtyLootSpawnCells);
              window.setTimeout(() => setCellDirtyLootFlashIndices([]), 480);
              sounds.select();
            }
            if (cleaningReward > 0) {
              setCoinFly({ source: "clean", cellIndex: index, amount: cleaningReward });
              window.setTimeout(() => setCoinFly(null), 800);
            }
          } else {
            setSelectedCell(index);
          }
        } else {
          const a = selectedCell;
          const b = index;
          setCellShakePair([a, b]);
          window.setTimeout(() => setCellShakePair(null), 300);
          const newGrid = state.grid.map((c) => ({ ...c }));
          const cellA = newGrid[selectedCell];
          const cellB = newGrid[index];
          const itemA = cellA.item;
          const itemB = cellB.item;
          newGrid[selectedCell] = gridCellAfterPlacingItem(cellA, itemB, cellB, genMax);
          newGrid[index] = gridCellAfterPlacingItem(cellB, itemA, cellA, genMax);

          setState({ ...state, grid: newGrid });
          setSelectedCell(null);
        }
      }
    }
  };

  const handleCompleteOrder = (orderId: string) => {
    if (!state || !progState || isSessionComplete) return;
    const order = state.orders.find((o) => o.id === orderId);
    if (!order || orderIsFulfilled(order)) return;

    const itemIndex = findFirstCellIndexForOrderDelivery(state.grid, order);
    if (itemIndex === -1) return;

    const itemId = state.grid[itemIndex].item!;
    const newGrid = [...state.grid];
    newGrid[itemIndex] = { item: null, cellState: newGrid[itemIndex].cellState };

    const prevDelivered = order.delivered[itemId] ?? 0;
    const updatedOrder: Order = {
      ...order,
      delivered: { ...order.delivered, [itemId]: prevDelivered + 1 },
    };

    if (!orderIsFulfilled(updatedOrder)) {
      setState({
        ...state,
        grid: newGrid,
        orders: state.orders.map((o) => (o.id === orderId ? updatedOrder : o)),
      });
      sounds.select();
      return;
    }

    const newOrders = state.orders.filter((o) => o.id !== orderId);
    newOrders.push(generateNewOrder(progState.level));

    const manager = new ProgressionManager(progState);
    const orderBonuses = manager.getActiveBonuses();

    let finalCoins = Math.round(order.rewardCoins * (1 + orderBonuses.income_bonus));
    let orderCoinDoubled = false;
    if (Math.random() < orderBonuses.bonus_chance) {
      finalCoins *= 2;
      orderCoinDoubled = true;
    }

    const { leveledUp } = manager.addXp(order.rewardXp);
    manager.addCoins(finalCoins);
    let afterOrder = manager.getState();

    const { reconstruction: rNext, completed: reconDone } = tickReconstructionAfterOrderComplete(
      progState.reconstruction
    );
    let finalProg = { ...afterOrder, reconstruction: rNext };
    let anyLevelUp = leveledUp;
    if (reconDone) {
      const m2 = new ProgressionManager(finalProg);
      m2.addCoins(reconDone.rewardCoins);
      const xr = m2.addXp(reconDone.rewardXp);
      anyLevelUp = anyLevelUp || xr.leveledUp;
      const st = m2.getState();
      const uz = [...st.unlockedZones];
      for (const z of reconDone.unlockZones ?? []) {
        if (!uz.includes(z)) uz.push(z);
      }
      finalProg = { ...st, unlockedZones: uz, reconstruction: rNext };
      updateQuestProgress("coins", reconDone.rewardCoins);
    }

    if (orderCoinDoubled) {
      setShowOrderCoinBonus(true);
      setTimeout(() => setShowOrderCoinBonus(false), 1500);
    }

    if (anyLevelUp) {
      triggerLevelUp();
    }

    setProgState(finalProg);
    setState({
      ...state,
      grid: newGrid,
      orders: newOrders,
      energy: anyLevelUp ? state.maxEnergy : state.energy,
    });
    setLastAction({ type: "order" });
    setOrdersCompleted((c) => c + 1);
    updateQuestProgress("order", 1);
    updateQuestProgress("coins", finalCoins);
    sounds.orderComplete();
    setCoinFly({ source: "order", orderId, amount: finalCoins });
    window.setTimeout(() => setCoinFly(null), 800);

    setSessionOrdersCompleted((prev) => {
      const next = prev + 1;
      if (next >= SESSION_ORDER_GOAL) setIsSessionComplete(true);
      return next;
    });
  };

  const handleReconstructionDeliver = () => {
    if (!state || !progState || isSessionComplete) return;
    const stage = getCurrentReconstructionStage(progState.reconstruction);
    if (!stage || stage.requirement.type !== "items") return;

    const delivered = tryDeliverReconstructionItem(progState.reconstruction, state.grid);
    if (!delivered) return;

    let nextRecon = delivered.reconstruction;
    const gridAfter = delivered.grid;
    const complete = tryCompleteReconstructionItemsStage(nextRecon);
    nextRecon = complete.reconstruction;
    const reconDone = complete.completed;

    let finalProg = { ...progState, reconstruction: nextRecon };
    let anyLevelUp = false;
    if (reconDone) {
      const m = new ProgressionManager(finalProg);
      m.addCoins(reconDone.rewardCoins);
      const xr = m.addXp(reconDone.rewardXp);
      anyLevelUp = xr.leveledUp;
      const st = m.getState();
      const uz = [...st.unlockedZones];
      for (const z of reconDone.unlockZones ?? []) {
        if (!uz.includes(z)) uz.push(z);
      }
      finalProg = { ...st, unlockedZones: uz, reconstruction: nextRecon };
      updateQuestProgress("coins", reconDone.rewardCoins);
    }

    if (anyLevelUp) triggerLevelUp();

    setProgState(finalProg);
    setState({
      ...state,
      grid: gridAfter,
      energy: anyLevelUp ? state.maxEnergy : state.energy,
    });
    sounds.select();
  };

  const handleStoryChoice = (nextBeatId: string | null) => {
    if (!currentBeat) return;
    const engine = new StoryEngine(shownBeats);
    setShownBeats(engine.markShown(currentBeat.id));
    if (nextBeatId) {
      const next = STORY_BEATS.find((b) => b.id === nextBeatId) ?? null;
      setCurrentBeat(next);
    } else {
      setCurrentBeat(null);
    }
  };

  const handlePurchaseUpgrade = (upgradeId: string) => {
    if (!progState || !state) return;
    const manager = new ProgressionManager(progState);
    const { success, newState: newProg, error } = manager.purchaseUpgrade(upgradeId);

    if (success) {
      const bonuses = new ProgressionManager(newProg).getActiveBonuses();
      const oldGenMax = getGeneratorMaxCharges(progState.purchasedUpgrades);
      const newGenMax = getGeneratorMaxCharges(newProg.purchasedUpgrades);
      let newGrid = state.grid;
      if (newGenMax > oldGenMax) {
        const delta = newGenMax - oldGenMax;
        newGrid = state.grid.map((cell) => {
          if (!cell.item) return cell;
          const d = ALL_ITEMS[cell.item];
          if (!d || !itemIsGenerator(d)) return cell;
          const cur =
            typeof cell.generatorCharges === "number"
              ? cell.generatorCharges
              : oldGenMax;
          return { ...cell, generatorCharges: Math.min(newGenMax, cur + delta) };
        });
      }
      setProgState(newProg);
      setState({
        ...state,
        grid: newGrid,
        maxEnergy: INITIAL_ENERGY + bonuses.energy_max,
      });
      updateQuestProgress("upgrade", 1);
      sounds.purchase();
      setPurchaseSparkleNonce((n) => n + 1);
    } else {
      alert(error);
    }
  };

  const handleClaimDaily = (coins: number, energy: number) => {
    const last = localStorage.getItem(LAST_DAILY_BONUS_KEY);
    const now = Date.now();
    if (last && now - Number(last) <= 20 * 60 * 60 * 1000) return;
    if (!progState || !state) return;
    const manager = new ProgressionManager(progState);
    manager.addCoins(coins);
    setProgState(manager.getState());
    setState((s) =>
      s
        ? {
            ...s,
            energy: Math.min(s.maxEnergy, s.energy + energy),
          }
        : s
    );
    try {
      localStorage.setItem(LAST_DAILY_BONUS_KEY, String(Date.now()));
      let streak = Number(localStorage.getItem(DAILY_STREAK_KEY) || "1");
      streak += 1;
      if (streak > 7) streak = 1;
      localStorage.setItem(DAILY_STREAK_KEY, String(streak));
      setDailyBonusDay(Math.min(7, Math.max(1, streak)));
    } catch {
      /* ignore */
    }
    setShowDailyBonus(false);
  };

  const handleClaimDailyQuest = (questId: string) => {
    let reward = 0;
    flushSync(() => {
      setDailyQuests((dq) => {
        const r = tryClaimDailyQuest(dq, questId);
        if (!r) return dq;
        reward = r.reward;
        return r.next;
      });
    });
    if (reward > 0) {
      setProgState((ps) => {
        if (!ps) return ps;
        const m = new ProgressionManager(ps);
        m.addCoins(reward);
        return m.getState();
      });
    }
  };

  const handleClaimWeekly = () => {
    let reward = 0;
    flushSync(() => {
      setDailyQuests((dq) => {
        const r = tryClaimWeekly(dq);
        if (!r) return dq;
        reward = r.reward;
        return r.next;
      });
    });
    if (reward > 0) {
      setProgState((ps) => {
        if (!ps) return ps;
        const m = new ProgressionManager(ps);
        m.addCoins(reward);
        return m.getState();
      });
    }
  };

  const handleOnboardingComplete = () => {
    setShownBeats((sb) =>
      sb.includes("onboarding_done") ? sb : [...sb, "onboarding_done"]
    );
  };

  /** Из главного меню: экран «Дом» (хаб), состояние игры не трогаем. */
  const handleContinueFromMenu = useCallback(() => {
    setCurrentScreen("hub");
  }, []);

  const handleNewGame = useCallback(() => {
    if (!window.confirm("Ты уверен? Весь прогресс будет сброшен.")) return;
    setSaveLoadedFromDisk(false);
    resetGame();
    setCurrentScreen("hub");
  }, [devMode]);

  /** С экрана «Дом» в миниигру; туториал при первом входе на поле. */
  const handlePlayFromHub = useCallback(() => {
    setCurrentScreen("game");
    if (state?.isFirstLaunch) {
      setShowTutorial(true);
      setState((s) => (s ? { ...s, isFirstLaunch: false } : s));
    }
  }, [state?.isFirstLaunch]);

  if (!state || !progState) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#F8F9FA] p-4 text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Загрузка игры...</h1>
        <p className="text-sm text-gray-500 mb-4">Если игра не загружается, попробуйте сбросить данные.</p>
        <button 
          onClick={resetGame}
          className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-md"
        >
          СБРОСИТЬ ДАННЫЕ
        </button>
      </div>
    );
  }

  const manager = new ProgressionManager(progState);
  const xpToNextLevel = manager.getXpToNextLevel(progState.level);
  const progress = (progState.xp / xpToNextLevel) * 100;

  const questBanner = getHomeQuestSummary(dailyQuests);

  const hasSave =
    saveLoadedFromDisk ||
    ordersCompleted > 0 ||
    progState.coins > 0 ||
    progState.level > 1 ||
    progState.xp > 0 ||
    !state.isFirstLaunch;

  return (
    <>
      {currentScreen === "menu" && (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <MainMenuScreen
            hasSave={hasSave}
            onContinue={handleContinueFromMenu}
            onNewGame={handleNewGame}
            onOpenSettings={() => setSettingsOpen(true)}
            devMode={devMode}
            onFullReset={handleFullReset}
          />
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            devMode={devMode}
            onToggleDevMode={handleToggleDevMode}
            soundOn={soundOn}
            onSoundOnChange={(on) => {
              setSoundOn(on);
              setSoundMuted(!on);
            }}
          />
        </div>
      )}
      {currentScreen === "hub" && (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <CafeHubScreen
            energy={state.energy}
            maxEnergy={state.maxEnergy}
            level={progState.level}
            coins={progState.coins}
            xpProgressPercent={progress}
            unlockedZones={progState.unlockedZones}
            onNavigateRoom={(zone) => {
              setActiveZone(zone);
              setCurrentScreen("room");
            }}
            dailyQuestCompleted={questBanner.completed}
            dailyQuestTotal={questBanner.total}
            dailyUnclaimedCount={questBanner.unclaimedCount}
            onOpenDaily={() => setCurrentScreen("daily")}
            onOpenCoinShop={() => setCoinShopOpen(true)}
            reconstruction={progState.reconstruction}
            onBackToMenu={handleBackToMainMenu}
            onPlay={handlePlayFromHub}
          />
          <CoinShopModal
            open={coinShopOpen}
            onClose={() => setCoinShopOpen(false)}
            coins={progState.coins}
            level={progState.level}
            purchasedUpgrades={progState.purchasedUpgrades}
            onPurchaseUpgrade={handlePurchaseUpgrade}
          />
        </div>
      )}
      {currentScreen === "daily" ? (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <DailyScreen
          dailyQuests={dailyQuests}
          streakDay={dailyBonusDay}
          onBack={() => setCurrentScreen("hub")}
          onClaimDailyBonus={handleClaimDaily}
          onClaimDailyQuest={handleClaimDailyQuest}
          onClaimWeekly={handleClaimWeekly}
        />
        </div>
      ) : null}
      {currentScreen === "room" && (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <RoomScreen
          activeZone={activeZone}
          progState={progState}
          onBack={() => setCurrentScreen("hub")}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          purchaseSparkleNonce={purchaseSparkleNonce}
        />
        </div>
      )}
      {currentScreen === "game" && (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <GameScreen
          state={state}
          progState={progState}
          showOrderCoinBonus={showOrderCoinBonus}
          devMode={devMode}
          onToggleDevMode={handleToggleDevMode}
          xpProgressPercent={progress}
          selectedCell={selectedCell}
          onGoHome={() => {
            setShowTutorial(false);
            setCurrentScreen("hub");
          }}
          onCellClick={handleCellClick}
          paidCleanMode={paidCleanMode}
          onTogglePaidCleanMode={() => setPaidCleanMode((v) => !v)}
          onCompleteOrder={handleCompleteOrder}
          onOpenTutorial={() => setShowTutorial(true)}
          mergePopIndex={cellMergePopIndex}
          cellUnlockedFlashIndices={cellUnlockedFlashIndices}
          cellDirtyLootFlashIndices={cellDirtyLootFlashIndices}
          cellShakePair={cellShakePair}
          coinFly={coinFly}
          gridWidth={GRID_WIDTH}
          gridHeight={GRID_HEIGHT}
          sessionOrdersCompleted={sessionOrdersCompleted}
          sessionOrderGoal={SESSION_ORDER_GOAL}
          isSessionComplete={isSessionComplete}
          onSessionNewGame={handleSessionNewGame}
          onSessionExitHome={handleSessionExitHome}
          isNoMoves={isNoMoves}
          onShuffleGrid={handleShuffleGrid}
          onNoMovesNewSession={handleSessionNewGame}
          onNoMovesExitHome={handleNoMovesExitHome}
          onReconstructionDeliver={handleReconstructionDeliver}
        />
        </div>
      )}

      {currentScreen === "game" && currentBeat ? (
        <DialogModal beat={currentBeat} onChoice={handleStoryChoice} />
      ) : null}

      {showDailyBonus ? (
        <DailyBonusModal
          day={dailyBonusDay}
          canClaim
          onClaim={handleClaimDaily}
          onClose={() => setShowDailyBonus(false)}
        />
      ) : null}

      {currentScreen === "game" &&
      progState.level === 1 &&
      !shownBeats.includes("onboarding_done") ? (
        <OnboardingOverlay onComplete={handleOnboardingComplete} />
      ) : null}

      {/* Туториал только в игре, не над главным меню */}
      <AnimatePresence>
        {currentScreen === "game" && showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-xs w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-blue-500 fill-blue-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-3 uppercase tracking-tight">Как играть</h2>
              <div className="space-y-3 text-gray-600 text-xs mb-6 text-left">
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">1</div>
                  <p>Нажми на <b>корзину 🧺</b> — рядом появится предмет 1 уровня, пока на клетке есть заряды.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">2</div>
                  <p>Объединяй <b>одинаковые</b> предметы, чтобы получить новый уровень!</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold">3</div>
                  <p>Выполняй <b>Заказы</b> сверху, чтобы получать Монеты и Опыт.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-100 hover:bg-blue-600 transition-colors"
              >
                ПОНЯТНО!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showLevelUpFlash ? (
        <div
          className="levelup-flash-overlay pointer-events-none fixed inset-0 z-50"
          aria-hidden
        />
      ) : null}

      {/* Level Up Effect */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-yellow-400 text-yellow-900 px-8 py-4 rounded-full font-black text-2xl shadow-2xl border-4 border-white flex flex-col items-center">
              <Star className="w-8 h-8 mb-1 fill-current" />
              НОВЫЙ УРОВЕНЬ!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes screen-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .screen-entering {
          animation: screen-in 0.2s ease-out;
        }
        @keyframes levelup-flash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        .levelup-flash-overlay {
          background: rgba(255, 215, 0, 0.3);
          animation: levelup-flash 0.5s ease-out forwards;
        }
        @keyframes order-bonus-toast-fade {
          0% { opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { opacity: 0; }
        }
        .order-bonus-toast {
          animation: order-bonus-toast-fade 1.5s ease forwards;
        }
      `}</style>
    </>
  );
}
