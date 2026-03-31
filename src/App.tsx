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
  ProgressionState,
  type AppScreen,
  type ActiveZone,
  type GridCell,
  type CoinFlyState,
  isObstacleCellState,
} from "./types";
import HomeScreen from "./screens/HomeScreen";
import RoomScreen from "./screens/RoomScreen";
import GameScreen from "./screens/GameScreen";
import { ProgressionManager, EconomyManager } from "./progressionManager";
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
import { initAudio, sounds } from "./utils/sounds";
import { getNeighborIndices } from "./utils/grid";
import { hasEffectiveMoves } from "./utils/availableMoves";

const SHOWN_BEATS_KEY = "shownBeats";
const LAST_DAILY_BONUS_KEY = "lastDailyBonus";
const DAILY_STREAK_KEY = "dailyStreak";

const GRID_WIDTH = 7;
const GRID_HEIGHT = 9;
const MAX_GRID_CELLS = GRID_WIDTH * GRID_HEIGHT;
const INITIAL_ENERGY = 100;
/** 1 е. энергии каждые 10 с, пока energy ниже maxEnergy. */
const ENERGY_REGEN_INTERVAL_MS = 10_000;
/** Доля бесплатного спавна (без траты энергии). */
const FREE_SPAWN_CHANCE = 0.25;
/** Базовая энергия за «СОЗДАТЬ» (>1 нужна, чтобы Math.round(base×(1−gen_speed)) давала заметную скидку). */
const SPAWN_COST = 2;
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
      if (raw === "normal" || raw === "dirty_1" || raw === "dirty_2") {
        cellState = raw;
      } else if (raw === "blocked") {
        cellState = "dirty_2";
      }
      return { item, cellState };
    }
    if (entry === null || typeof entry === "string") {
      return { item: entry, cellState: "normal" };
    }
    return createNormalEmptyGridCell();
  });
}

function createInitialOrders(): Order[] {
  return [
    { id: "o1", requiredItemId: "f2", rewardCoins: 15, rewardXp: 10 },
    { id: "o2", requiredItemId: "s2", rewardCoins: 20, rewardXp: 15 },
  ];
}

function hydrateGameStateFromStorage(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const grid = normalizeGridFromStorage(g.grid, MAX_GRID_CELLS);
  if (!grid) return null;
  return {
    grid,
    energy: typeof g.energy === "number" ? g.energy : INITIAL_ENERGY,
    maxEnergy: typeof g.maxEnergy === "number" ? g.maxEnergy : INITIAL_ENERGY,
    orders: Array.isArray(g.orders) ? (g.orders as Order[]) : createInitialOrders(),
    isFirstLaunch: g.isFirstLaunch !== false,
  };
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [progState, setProgState] = useState<ProgressionState | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLevelUpFlash, setShowLevelUpFlash] = useState(false);
  const [showOrderCoinBonus, setShowOrderCoinBonus] = useState(false);
  /** Разработка: спавн без списания энергии и кнопка «СОЗДАТЬ» при 0 энергии. */
  const [devMode, setDevMode] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("home");
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
  const [cellShakePair, setCellShakePair] = useState<[number, number] | null>(null);
  const [coinFly, setCoinFly] = useState<CoinFlyState | null>(null);
  /** Нет эффективных ходов (слияние / заказ / спавн при энергии); UI мягкий, ввод не блокируем. */
  const [isNoMoves, setIsNoMoves] = useState(false);
  const [sessionOrdersCompleted, setSessionOrdersCompleted] = useState(0);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  /** Режим: клик по грязной клетке тратит монеты на очистку (без Shift). */
  const [paidCleanMode, setPaidCleanMode] = useState(false);
  const [showFreeSpawnLabel, setShowFreeSpawnLabel] = useState(false);
  const [purchaseSparkleNonce, setPurchaseSparkleNonce] = useState(0);
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
        grid: applyTestRandomDirty2Cells(
          Array.from({ length: MAX_GRID_CELLS }, () => createNormalEmptyGridCell())
        ),
      };
    });
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  /** Новая сессия на поле: сетка и счётчик заказов; монеты и уровень не трогаем. */
  const handleSessionNewGame = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        grid: applyTestRandomDirty2Cells(
          Array.from({ length: MAX_GRID_CELLS }, () => createNormalEmptyGridCell())
        ),
        orders: createInitialOrders(),
      };
    });
    setSessionOrdersCompleted(0);
    setIsSessionComplete(false);
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  const handleSessionExitHome = useCallback(() => {
    setIsSessionComplete(false);
    setSessionOrdersCompleted(0);
    setCurrentScreen("home");
  }, []);

  const handleNoMovesExitHome = useCallback(() => {
    setCurrentScreen("home");
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  /** Победа сессии не показывает «нет ходов». Иначе — нет слияний, нет заказов, нет спавна (пустые при 0 энергии не считаются). */
  useEffect(() => {
    if (!state || currentScreen !== "game") {
      setIsNoMoves(false);
      return;
    }
    if (isSessionComplete) {
      setIsNoMoves(false);
      return;
    }
    setIsNoMoves(!hasEffectiveMoves(state.grid, state.orders, state.energy));
  }, [state, currentScreen, isSessionComplete]);

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
    };
    const initialGameState: GameState = {
      grid: applyTestRandomDirty2Cells(
        Array.from({ length: MAX_GRID_CELLS }, () => createNormalEmptyGridCell())
      ),
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
    setCurrentScreen("home");
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
    if (!window.confirm("Reset game progress?")) return;
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
        if (parsed.gameState && parsed.progState) {
          const hydrated = hydrateGameStateFromStorage(parsed.gameState);
          if (hydrated) {
            setState(hydrated);
            setProgState(parsed.progState as ProgressionState);
            setOrdersCompleted(
              typeof parsed.ordersCompleted === "number" ? parsed.ordersCompleted : 0
            );
            setShownBeats(sb);
            const streak = Number(localStorage.getItem(DAILY_STREAK_KEY) || "1");
            setDailyBonusDay(Math.min(7, Math.max(1, streak)));
            return;
          }
        }
      }
      resetGame();
    } catch (e) {
      console.error("Failed to load state:", e);
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

  /** Автоочередь сюжета: прогресс / заказы / показанные биты */
  useEffect(() => {
    if (!progState) return;
    setCurrentBeat((cur) => {
      if (cur) return cur;
      const next = new StoryEngine(shownBeats).getNextBeat(progState, ordersCompleted);
      return next ?? null;
    });
  }, [progState, shownBeats, ordersCompleted]);

  useEffect(() => {
    if (currentScreen !== "home" || !progState) return;
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

  const generateNewOrder = (level: number): Order => {
    const chains = Object.values(ITEM_CHAINS);
    const randomChain = chains[Math.floor(Math.random() * chains.length)];
    const maxItemLevel = Math.min(level + 1, 7);
    const randomLevel = Math.floor(Math.random() * maxItemLevel) + 1;
    const item = randomChain.items[randomLevel - 1];
    
    const difficulty = randomLevel < 3 ? "simple" : randomLevel < 5 ? "medium" : "hard";
    const reward = EconomyManager.calculateOrderReward(difficulty);

    return {
      id: Math.random().toString(36).substr(2, 9),
      requiredItemId: item.id,
      rewardCoins: reward.coins,
      rewardXp: reward.xp,
    };
  };

  const handleSpawn = () => {
    if (!state || !progState || isSessionComplete) return;

    const spawnBonuses = new ProgressionManager(progState).getActiveBonuses();
    const finalCost = Math.max(1, Math.round(SPAWN_COST * (1 - spawnBonuses.gen_speed)));
    if (!devMode && state.energy < finalCost) return;

    const emptyIndices = state.grid
      .map((cell, index) => (cell.item === null ? index : null))
      .filter((index): index is number => index !== null);

    if (emptyIndices.length === 0) return;

    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const chains = Object.values(ITEM_CHAINS);
    const randomChain = chains[Math.floor(Math.random() * chains.length)];
    const newItemId = randomChain.items[0].id;

    const newGrid = [...state.grid];
    newGrid[randomIndex] = { ...newGrid[randomIndex], item: newItemId };

    setState({
      ...state,
      grid: newGrid,
      energy: devMode ? state.energy : state.energy - finalCost,
    });
    setLastAction({ type: "spawn", index: randomIndex });
  };

  const handleFreeSpawnAttempt = () => {
    if (!state || !progState || isSessionComplete) return;

    const emptyIndices = state.grid
      .map((cell, index) => (cell.item === null ? index : null))
      .filter((index): index is number => index !== null);

    if (emptyIndices.length === 0) return;
    if (Math.random() >= FREE_SPAWN_CHANCE) return;

    const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    const chains = Object.values(ITEM_CHAINS);
    const randomChain = chains[Math.floor(Math.random() * chains.length)];
    const newItemId = randomChain.items[0].id;
    const newGrid = [...state.grid];
    newGrid[randomIndex] = { ...newGrid[randomIndex], item: newItemId };

    console.log("Free spawn!");
    setShowFreeSpawnLabel(true);
    window.setTimeout(() => setShowFreeSpawnLabel(false), 1200);

    setState({ ...state, grid: newGrid });
    setLastAction({ type: "spawn", index: randomIndex });
  };

  const handleCellClick = (index: number, shiftKey = false) => {
    if (!state || !progState || isSessionComplete) return;

    const cell = state.grid[index];
    const wantsPaidClean = shiftKey || paidCleanMode;

    if (isObstacleCellState(cell.cellState) && wantsPaidClean) {
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
      if (state.grid[index].item !== null) {
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
          const chain = ITEM_CHAINS[itemDef.chain];
          const nextItem = chain.items[itemDef.level];

          if (nextItem) {
            const newGrid = [...state.grid];
            newGrid[selectedCell] = { ...newGrid[selectedCell], item: null };
            newGrid[index] = { ...newGrid[index], item: nextItem.id };

            const unlockedNeighborIndices: number[] = [];
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
          newGrid[selectedCell] = { ...cellA, item: itemB };
          newGrid[index] = { ...cellB, item: itemA };

          setState({ ...state, grid: newGrid });
          setSelectedCell(null);
        }
      }
    }
  };

  const handleCompleteOrder = (orderId: string) => {
    if (!state || !progState || isSessionComplete) return;
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const itemIndex = state.grid.findIndex((cell) => cell.item === order.requiredItemId);
    if (itemIndex === -1) return;

    const newGrid = [...state.grid];
    newGrid[itemIndex] = { ...newGrid[itemIndex], item: null };

    const newOrders = state.orders.filter(o => o.id !== orderId);
    newOrders.push(generateNewOrder(progState.level));

    const manager = new ProgressionManager(progState);
    const orderBonuses = manager.getActiveBonuses();

    // income_bonus: бонус к монетам заказа. finalCoins = round(rewardCoins * (1 + income_bonus)), напр. 0.25 => +25%
    let finalCoins = Math.round(order.rewardCoins * (1 + orderBonuses.income_bonus));
    // bonus_chance: после income_bonus — шанс удвоить монеты заказа (до addCoins)
    let orderCoinDoubled = false;
    if (Math.random() < orderBonuses.bonus_chance) {
      finalCoins *= 2;
      orderCoinDoubled = true;
    }

    const { leveledUp } = manager.addXp(order.rewardXp);
    manager.addCoins(finalCoins);
    const newProg = manager.getState();

    if (orderCoinDoubled) {
      setShowOrderCoinBonus(true);
      setTimeout(() => setShowOrderCoinBonus(false), 1500);
    }

    if (leveledUp) {
      triggerLevelUp();
    }

    setProgState(newProg);
    setState({
      ...state,
      grid: newGrid,
      orders: newOrders,
      energy: leveledUp ? state.maxEnergy : state.energy,
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
      const bonuses = manager.getActiveBonuses();
      setProgState(newProg);
      setState({
        ...state,
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
  const spawnBonuses = manager.getActiveBonuses();
  // Та же формула, что в handleSpawn: итоговая стоимость «СОЗДАТЬ» с учётом gen_speed
  const spawnEnergyCost = Math.max(1, Math.round(SPAWN_COST * (1 - spawnBonuses.gen_speed)));

  const questBanner = getHomeQuestSummary(dailyQuests);

  const goPlay = () => {
    setCurrentScreen("game");
    if (state.isFirstLaunch) {
      setShowTutorial(true);
      setState((s) => (s ? { ...s, isFirstLaunch: false } : s));
    }
  };

  return (
    <>
      {currentScreen === "home" && (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <HomeScreen
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
          onPlay={goPlay}
          dailyQuestCompleted={questBanner.completed}
          dailyQuestTotal={questBanner.total}
          dailyUnclaimedCount={questBanner.unclaimedCount}
          onOpenDaily={() => setCurrentScreen("daily")}
          onResetGame={handleFullReset}
        />
        </div>
      )}
      {currentScreen === "daily" ? (
        <div className={screenEntering ? "screen-entering h-[100dvh]" : "h-[100dvh]"}>
          <DailyScreen
          dailyQuests={dailyQuests}
          streakDay={dailyBonusDay}
          onBack={() => setCurrentScreen("home")}
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
          onBack={() => setCurrentScreen("home")}
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
          spawnEnergyCost={spawnEnergyCost}
          showFreeSpawnLabel={showFreeSpawnLabel}
          devMode={devMode}
          onToggleDevMode={handleToggleDevMode}
          xpProgressPercent={progress}
          selectedCell={selectedCell}
          onGoHome={() => setCurrentScreen("home")}
          onSpawn={handleSpawn}
          onFreeSpawnAttempt={handleFreeSpawnAttempt}
          onCellClick={handleCellClick}
          paidCleanMode={paidCleanMode}
          onTogglePaidCleanMode={() => setPaidCleanMode((v) => !v)}
          onCompleteOrder={handleCompleteOrder}
          onOpenTutorial={() => setShowTutorial(true)}
          mergePopIndex={cellMergePopIndex}
          cellUnlockedFlashIndices={cellUnlockedFlashIndices}
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
        />
        </div>
      )}

      {currentBeat ? (
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

      {/* Tutorial Overlay */}
      <AnimatePresence>
        {showTutorial && (
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
                  <p>Нажми <b>СОЗДАТЬ</b>, чтобы получить предмет. Цена в энергии — число на кнопке.</p>
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
