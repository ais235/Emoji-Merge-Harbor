/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Play, Star } from "lucide-react";
import {
  GameState,
  ALL_ITEMS,
  ITEM_CHAINS,
  Order,
  type OrderRequirement,
  type MergeableItemDefinition,
  type ItemChain,
  chainsFromGridGenerators,
  orderIsFulfilled,
  orderAllRemainingSatisfiedFromGrid,
  collectIndicesForFullOrderDelivery,
  ORDER_CUSTOMER_AVATAR_PATHS,
  resolveOrderCustomerAvatar,
  ProgressionState,
  type AppScreen,
  type ActiveZone,
  ALL_ACTIVE_ZONES,
  progressZoneId,
  activeZoneFromGeneratorItemId,
  generatorItemIdForZone,
  mergeChainIdForZone,
  isActiveZone,
  type GridCell,
  type FieldProgressState,
  type CoinFlyState,
  isOpenCellType,
  isBlockedCellType,
  itemIsGenerator,
  itemIsResourcePickup,
  COIN_PICKUP_ITEM_ID,
  ENERGY_PICKUP_ITEM_ID,
  GENERATOR_RESOURCE_DROP_CHANCE,
  MAX_ACTIVE_ORDERS,
  isCobwebUnknownPlaceholder,
} from "./types";
import MainMenuScreen from "./screens/MainMenuScreen";
import CafeHubScreen from "./screens/CafeHubScreen";
import RoomScreen from "./screens/RoomScreen";
import GameScreen from "./screens/GameScreen";
import CollectionScreen from "./screens/CollectionScreen";
import { ProgressionManager, EconomyManager, getGeneratorMaxCharges } from "./progressionManager";
import { onUpgradePurchased } from "./upgradeDialogs";
import { HUB_ZONES, mergeUnlockedZonesForLevel, migrateLegacyUpgradeIds, UPGRADES } from "./progressionData";
import {
  hydrateCollectionFromGrid,
  normalizeCollectionFields,
  registerCollectiblesBulk,
} from "./collection";
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
import { playSfx } from "./utils/playSfx";
import CoinFlyBurst, { type CoinFlyBurstSpec } from "./components/CoinFlyBurst";
import { pickEmptyCellForGeneratorSpawn } from "./utils/grid";
import { hasEffectiveMoves } from "./utils/availableMoves";
import { migrateLegacyGridCell } from "./utils/gridUnlockHelpers";
import { buildInitialGrid, type BuildInitialGridResult } from "./utils/buildInitialGrid";
import {
  handleMergeFieldProgress,
  handleOrderFieldProgress,
  migrateFieldProgressFromGrid,
  type MergeFieldProgressResult,
} from "./utils/mergeFieldProgress";
import { emptyGridCell, generatorGridCell, itemGridCell, withSyncedItemMeta } from "./utils/gridCells";
import {
  bumpMaxSeenItemLevelFromGrid,
  playerTierMaxOrderItemLevel,
  playerTierMinOrderItemLevel,
  playerTierOrderChainSliceCount,
} from "./utils/sessionGridProgress";
import {
  ENERGY_AD_REWARD,
  ENERGY_MAX_DEFAULT,
  ENERGY_ORDER_COMPLETE_BONUS,
  ENERGY_REGEN_INTERVAL_MS,
} from "./gameBalance";
import {
  canGenerateMinigameOrder,
  incrementMinigameOrderComplete,
  maxMinigameOrdersForZone,
  minigameOrdersCompletedInRoom,
  resetMinigameOrdersForRoom,
  nextVisualRepairOffer,
  upgradeZoneToActiveZone,
} from "./utils/roomOrderLimit";
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

const GRID_WIDTH = 9;
const GRID_HEIGHT = 12;
const MAX_GRID_CELLS = GRID_WIDTH * GRID_HEIGHT;
/** Стартовый и базовый максимум энергии (до бонусов из прогрессии). */
const INITIAL_ENERGY = ENERGY_MAX_DEFAULT;

/** В dev mode на хабе считаем открытыми все комнаты (id как в `unlockedZones`). */
function hubUnlockedZonesForUi(devMode: boolean, prog: ProgressionState): string[] {
  if (!devMode) return prog.unlockedZones;
  const set = new Set(prog.unlockedZones);
  for (const z of ALL_ACTIVE_ZONES) {
    set.add(progressZoneId(z));
  }
  return [...set];
}

/** Стартовая энергия при новой игре, если в UI включён dev mode (сохранения не трогаем). */
const DEV_RESET_ENERGY = 999;

const STORAGE_KEY = "emoji_merge_harbor_state_v2"; // Changed key to avoid old state issues
const LAST_SAVE_AT_KEY = "emoji_merge_harbor_last_save_ts";

function readSaveAgeMinutes(): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const t = localStorage.getItem(LAST_SAVE_AT_KEY);
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n)) return null;
    return Math.floor((Date.now() - n) / 60000);
  } catch {
    return null;
  }
}

function createNormalEmptyGridCell(): GridCell {
  return emptyGridCell();
}

/** Генератор комнаты в первой свободной обычной клетке (новая сетка / сессия). */
function placeInitialGenerator(grid: GridCell[], zone: ActiveZone): GridCell[] {
  const next = grid.map((c) => ({ ...c }));
  const i = next.findIndex((c) => c.cellType === "empty" && c.item === null);
  if (i >= 0) {
    next[i] = generatorGridCell(generatorItemIdForZone(zone));
  }
  return next;
}

/** После обмена предметами между клетками. */
function gridCellAfterPlacingItem(targetCell: GridCell, newItem: string | null): GridCell {
  if (!newItem) {
    return emptyGridCell();
  }
  const d = ALL_ITEMS[newItem];
  if (d && itemIsGenerator(d)) {
    return generatorGridCell(newItem);
  }
  return withSyncedItemMeta(itemGridCell(newItem));
}

function gridHasGenerator(grid: GridCell[]): boolean {
  return grid.some((c) => {
    if (!c.item) return false;
    const d = ALL_ITEMS[c.item];
    return Boolean(d && itemIsGenerator(d));
  });
}

/** Старые сохранения без генератора — ставим генератор текущей комнаты. */
function ensureGeneratorOnGrid(grid: GridCell[], zone: ActiveZone): GridCell[] {
  if (gridHasGenerator(grid)) return grid;
  return placeInitialGenerator(grid.map((c) => ({ ...c })), zone);
}

function inferPlayZoneFromGrid(grid: GridCell[]): ActiveZone {
  for (const c of grid) {
    if (!c.item) continue;
    const z = activeZoneFromGeneratorItemId(c.item);
    if (z) return z;
  }
  return "hall";
}

function buildFreshPlayGrid(zone: ActiveZone): BuildInitialGridResult {
  return buildInitialGrid(GRID_WIDTH, GRID_HEIGHT, zone);
}

function normalizeFieldProgressFromStorage(
  raw: unknown,
  grid: GridCell[],
  totalOrdersCompletedFallback: number
): FieldProgressState {
  const migrated = migrateFieldProgressFromGrid(grid, GRID_WIDTH, GRID_HEIGHT, totalOrdersCompletedFallback);
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const q = o.unlockQueues;
    if (q && typeof q === "object") {
      const qq = q as Record<string, unknown>;
      const z1 = qq.zone_1;
      const z2 = qq.zone_2;
      const z3 = qq.zone_3;
      if (Array.isArray(z1) && Array.isArray(z2) && Array.isArray(z3)) {
        const nums = (arr: unknown[]) =>
          arr.filter((x): x is number => typeof x === "number" && x >= 0 && Number.isFinite(x) && Number.isInteger(x));
        return {
          unlockQueues: {
            zone_1: nums(z1),
            zone_2: nums(z2),
            zone_3: nums(z3),
          },
          zone1MergeProgress:
            typeof o.zone1MergeProgress === "number"
              ? Math.max(0, Math.floor(o.zone1MergeProgress))
              : migrated.zone1MergeProgress,
          ordersForFieldProgress:
            typeof o.ordersForFieldProgress === "number"
              ? Math.max(0, Math.floor(o.ordersForFieldProgress))
              : migrated.ordersForFieldProgress,
        };
      }
    }
  }
  return migrated;
}

function normalizeGridFromStorage(rawGrid: unknown, expectedLen: number): GridCell[] | null {
  if (!Array.isArray(rawGrid) || rawGrid.length !== expectedLen) return null;
  return rawGrid.map((entry) => migrateLegacyGridCell(entry));
}

function applyEnergyCapsForProgress(gs: GameState, prog: ProgressionState): GameState {
  const bonuses = new ProgressionManager(prog).getActiveBonuses();
  const cap = INITIAL_ENERGY + bonuses.energy_max;
  return {
    ...gs,
    maxEnergy: cap,
    energy: Math.min(gs.energy, cap),
    lastEnergyRegenAt: gs.lastEnergyRegenAt ?? Date.now(),
  };
}

function mergeableItemsInChain(chain: ItemChain): MergeableItemDefinition[] {
  return chain.items.filter(
    (it): it is MergeableItemDefinition =>
      !itemIsGenerator(it) && !itemIsResourcePickup(it) && "level" in it
  );
}

function buildRandomSessionOrder(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone,
  orderId: string
): Order {
  const chainsFromGens = chainsFromGridGenerators(grid);
  const chainsBase =
    chainsFromGens.length > 0 ? chainsFromGens : [ITEM_CHAINS[mergeChainIdForZone(zone)] ?? ITEM_CHAINS.fruit];

  const tierMin = playerTierMinOrderItemLevel(level);
  const tierMaxCap = playerTierMaxOrderItemLevel(level);
  /** На 1 уровень выше максимума «видел на поле» — стимул к слияниям; не выше потолка по уровню игрока. */
  const orderMaxLevel = Math.min(Math.max(1, maxSeenItemLevel) + 1, tierMaxCap);
  const orderMinLevel = playerTierMinOrderItemLevel(level);
  const allowedMinLevel = Math.max(1, Math.min(orderMinLevel, orderMaxLevel));
  const allowedMaxLevel = Math.max(allowedMinLevel, orderMaxLevel);

  const spawnChainIds = new Set(chainsBase.map((c) => c.id));
  const candidateIds = new Set<string>();

  for (const c of grid) {
    if (c.cellType !== "item" && c.cellType !== "cobweb") continue;
    if (!c.item || isCobwebUnknownPlaceholder(c)) continue;
    const d = ALL_ITEMS[c.item];
    if (!d || !("level" in d) || itemIsGenerator(d) || itemIsResourcePickup(d)) continue;
    const lv = c.cellType === "cobweb" ? Math.max(1, c.itemLevel) : d.level;
    if (lv < allowedMinLevel || lv > allowedMaxLevel) continue;
    candidateIds.add(c.item);
  }

  for (const ch of chainsBase) {
    for (const it of mergeableItemsInChain(ch)) {
      if (it.level >= allowedMinLevel && it.level <= allowedMaxLevel) candidateIds.add(it.id);
    }
  }

  const chainSlice = playerTierOrderChainSliceCount(level, chainsBase.length);
  const chainsForFilter = chainsBase.slice(0, Math.max(1, chainSlice));
  const allowedChainIds = new Set(chainsForFilter.map((c) => c.id));

  for (const id of [...candidateIds]) {
    const d = ALL_ITEMS[id];
    if (!d || !("level" in d) || itemIsGenerator(d) || itemIsResourcePickup(d)) continue;
    const onGrid = grid.some((cell) => {
      if (cell.item !== id || (cell.cellType !== "item" && cell.cellType !== "cobweb")) return false;
      const lv = cell.cellType === "cobweb" ? Math.max(1, cell.itemLevel) : d.level;
      return lv >= allowedMinLevel && lv <= allowedMaxLevel;
    });
    const spawnable =
      d.level >= allowedMinLevel &&
      d.level <= allowedMaxLevel &&
      spawnChainIds.has(d.chain) &&
      allowedChainIds.has(d.chain);
    if (!onGrid && !spawnable) candidateIds.delete(id);
  }

  const poolShuffled = [...candidateIds].sort(() => Math.random() - 0.5);
  const requirements: OrderRequirement[] = [];
  const firstPick = poolShuffled[0];
  if (firstPick) requirements.push({ itemId: firstPick, count: 1 });

  if (requirements.length === 0) {
    for (const ch of chainsBase) {
      const pool = mergeableItemsInChain(ch).filter(
        (x) => x.level >= allowedMinLevel && x.level <= allowedMaxLevel
      );
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        requirements.push({ itemId: pick.id, count: 1 });
        break;
      }
    }
  }
  if (requirements.length === 0) {
    const ch = chainsBase[0]!;
    const mergeables = mergeableItemsInChain(ch);
    const poolStrict = mergeables.filter((x) => x.level >= allowedMinLevel && x.level <= allowedMaxLevel);
    const pool =
      poolStrict.length > 0
        ? poolStrict
        : mergeables.filter((x) => x.level <= allowedMaxLevel);
    const pick =
      pool.find((x) => x.level >= allowedMinLevel) ?? pool[pool.length - 1] ?? mergeables[0];
    if (pick) requirements.push({ itemId: pick.id, count: 1 });
  }
  if (requirements.length === 0) {
    const mergeables = mergeableItemsInChain(ITEM_CHAINS.fruit);
    const pick =
      mergeables.find((x) => x.level >= allowedMinLevel && x.level <= allowedMaxLevel) ??
      mergeables.filter((x) => x.level <= allowedMaxLevel).at(-1) ??
      mergeables[0];
    if (pick) requirements.push({ itemId: pick.id, count: 1 });
  }
  if (requirements.length === 0) {
    requirements.push({ itemId: mergeableItemsInChain(ITEM_CHAINS.fruit)[0]?.id ?? "f1", count: 1 });
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
  const customerAvatar =
    ORDER_CUSTOMER_AVATAR_PATHS[Math.floor(Math.random() * ORDER_CUSTOMER_AVATAR_PATHS.length)]!;

  return {
    id: orderId,
    instanceId: crypto.randomUUID(),
    requirements,
    delivered: {},
    rewardCoins,
    rewardXp,
    customerAvatar,
  };
}

/** Сигнатура слота заказа: конкретный предмет уровня (id уже задаёт уровень в цепочке). */
function orderRequirementKey(itemId: string): string | null {
  const d = ALL_ITEMS[itemId];
  if (!d || !("level" in d) || itemIsGenerator(d) || itemIsResourcePickup(d)) return null;
  return `${itemId}:${d.level}`;
}

function orderRequirementKeySet(order: Order): Set<string> {
  const keys = new Set<string>();
  for (const r of order.requirements) {
    const k = orderRequirementKey(r.itemId);
    if (k) keys.add(k);
  }
  return keys;
}

/** Активные заказы не должны дублировать один и тот же предмет (тот же id = тот же уровень в merge-цепочке). */
function orderConflictsWithExisting(candidate: Order, existing: Order[]): boolean {
  const cKeys = orderRequirementKeySet(candidate);
  if (cKeys.size === 0) return false;
  return existing.some((o) => {
    const oKeys = orderRequirementKeySet(o);
    for (const k of cKeys) {
      if (oKeys.has(k)) return true;
    }
    return false;
  });
}

function buildUniqueRandomOrder(
  existing: Order[],
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone,
  orderId: string
): Order {
  let attempts = 0;
  let order = buildRandomSessionOrder(level, maxSeenItemLevel, grid, zone, orderId);
  while (attempts < 22 && orderConflictsWithExisting(order, existing)) {
    attempts += 1;
    order = buildRandomSessionOrder(level, maxSeenItemLevel, grid, zone, `${orderId}_u${attempts}`);
  }
  return order;
}

function createInitialOrders(
  grid: GridCell[],
  zone: ActiveZone,
  level: number,
  maxSeenItemLevel: number,
  orderLimitProg: Pick<ProgressionState, "minigameOrdersAtRoomRepair" | "purchasedUpgrades" | "level">
): Order[] {
  const out: Order[] = [];
  let i = 0;
  while (out.length < MAX_ACTIVE_ORDERS && canGenerateMinigameOrder(orderLimitProg, zone)) {
    out.push(buildUniqueRandomOrder(out, level, maxSeenItemLevel, grid, zone, `o${i + 1}`));
    i += 1;
    if (i > 20) break;
  }
  return out;
}

function generateNewOrder(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone,
  existingOrders: Order[]
): Order {
  return buildUniqueRandomOrder(
    existingOrders,
    level,
    maxSeenItemLevel,
    grid,
    zone,
    Math.random().toString(36).slice(2, 11)
  );
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
        const itemLevel =
          typeof q.itemLevel === "number" && q.itemLevel >= 1 ? Math.floor(q.itemLevel) : undefined;
        return itemLevel !== undefined ? { itemId, count, itemLevel } : { itemId, count };
      })
      .filter((x): x is OrderRequirement => x !== null);
    if (requirements.length === 0) return null;
  } else if (typeof r.requiredItemId === "string") {
    requirements = [{ itemId: r.requiredItemId, count: 1 }];
  } else {
    return null;
  }

  {
    const deduped: OrderRequirement[] = [];
    const seen = new Set<string>();
    for (const req of requirements) {
      if (seen.has(req.itemId)) continue;
      seen.add(req.itemId);
      deduped.push({ itemId: req.itemId, count: 1 });
    }
    requirements = deduped.slice(0, 3);
  }
  if (requirements.length === 0) return null;

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

  const instanceId =
    typeof r.instanceId === "string" && r.instanceId.length > 0 ? r.instanceId : crypto.randomUUID();

  const customerAvatarRaw =
    typeof r.customerAvatar === "string" && r.customerAvatar.trim().startsWith("/avatars/")
      ? r.customerAvatar.trim()
      : null;
  const customerEmojiRaw =
    typeof r.customerEmoji === "string" && r.customerEmoji.length > 0 ? r.customerEmoji : null;

  const customerAvatar = resolveOrderCustomerAvatar({
    id,
    customerAvatar: customerAvatarRaw ?? undefined,
    customerEmoji: customerEmojiRaw ?? undefined,
  });

  return {
    id,
    instanceId,
    requirements,
    delivered,
    rewardCoins,
    rewardXp,
    customerAvatar,
  };
}

function hydrateGameStateFromStorage(
  raw: unknown,
  defaultLevel = 1,
  maxSeenItemLevel = 1,
  progForOrderLimit: Pick<
    ProgressionState,
    "minigameOrdersAtRoomRepair" | "purchasedUpgrades" | "level" | "totalOrdersCompleted"
  > | null = null
): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const playZone = isActiveZone(g.playZone) ? (g.playZone as ActiveZone) : "hall";
  let grid = normalizeGridFromStorage(g.grid, MAX_GRID_CELLS);
  let fieldProgress: FieldProgressState;
  if (!grid || grid.length !== MAX_GRID_CELLS) {
    const built = buildFreshPlayGrid(playZone);
    grid = ensureGeneratorOnGrid(built.grid, playZone);
    fieldProgress = built.fieldProgress;
  } else {
    grid = ensureGeneratorOnGrid(grid, playZone);
    const ordersHint =
      typeof progForOrderLimit?.totalOrdersCompleted === "number"
        ? Math.max(0, Math.floor(progForOrderLimit.totalOrdersCompleted))
        : 0;
    fieldProgress = normalizeFieldProgressFromStorage(g.fieldProgress, grid, ordersHint);
  }
  const inferredZone = isActiveZone(g.playZone) ? g.playZone : inferPlayZoneFromGrid(grid);
  const lastEnergyRegenAt =
    typeof g.lastEnergyRegenAt === "number" && Number.isFinite(g.lastEnergyRegenAt)
      ? g.lastEnergyRegenAt
      : Date.now();
  return {
    grid,
    fieldProgress,
    energy: typeof g.energy === "number" ? g.energy : INITIAL_ENERGY,
    maxEnergy: typeof g.maxEnergy === "number" ? g.maxEnergy : INITIAL_ENERGY,
    lastEnergyRegenAt,
    orders: (() => {
      const rawO = Array.isArray(g.orders) ? normalizeOrdersFromStorage(g.orders) : [];
      const limitProg: Pick<
        ProgressionState,
        "minigameOrdersAtRoomRepair" | "purchasedUpgrades" | "level" | "totalOrdersCompleted"
      > = progForOrderLimit ?? {
        level: defaultLevel,
        purchasedUpgrades: [],
        minigameOrdersAtRoomRepair: {},
        totalOrdersCompleted: 0,
      };
      let o =
        rawO.length > 0
          ? rawO
          : createInitialOrders(grid, inferredZone, defaultLevel, maxSeenItemLevel, limitProg);
      while (o.length < MAX_ACTIVE_ORDERS && canGenerateMinigameOrder(limitProg, inferredZone)) {
        o.push(generateNewOrder(limitProg.level, maxSeenItemLevel, grid, inferredZone, o));
      }
      return o.slice(0, MAX_ACTIVE_ORDERS);
    })(),
    isFirstLaunch: g.isFirstLaunch !== false,
    playZone: inferredZone,
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
  return hydrateGameStateFromStorage(p.gameState, 1, 1) !== null;
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [progState, setProgState] = useState<ProgressionState | null>(null);
  const progStateRef = useRef<ProgressionState | null>(null);
  progStateRef.current = progState;
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLevelUpFlash, setShowLevelUpFlash] = useState(false);
  const [showOrderCoinBonus, setShowOrderCoinBonus] = useState(false);
  /** Разработка: без ограничений энергии там, где она ещё используется. */
  const [devMode, setDevMode] = useState(false);
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
  /** Усиленная вспышка при открытии ящика с генератором. */
  const [cellUnlockHeavyFlash, setCellUnlockHeavyFlash] = useState(false);
  const [cellShakePair, setCellShakePair] = useState<[number, number] | null>(null);
  const [coinFly, setCoinFly] = useState<CoinFlyState | null>(null);
  const [coinFlyBurst, setCoinFlyBurst] = useState<CoinFlyBurstSpec | null>(null);
  const [mergeBurstCellIndex, setMergeBurstCellIndex] = useState<number | null>(null);
  /** Нет эффективных ходов (слияние / заказ / спавн при энергии); UI мягкий, ввод не блокируем. */
  const [isNoMoves, setIsNoMoves] = useState(false);
  const [purchaseSparkleNonce, setPurchaseSparkleNonce] = useState(0);
  const [roomPurchaseToast, setRoomPurchaseToast] = useState<string | null>(null);
  const purchaseToastClearRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  /** После исчерпания заказов в миниигре — подсветка комнаты в хабе. */
  const [hubHighlightZone, setHubHighlightZone] = useState<ActiveZone | null>(null);
  const [hubOrdersBackToast, setHubOrdersBackToast] = useState<string | null>(null);
  const [hubPulsePlayButton, setHubPulsePlayButton] = useState(false);
  const hubOrdersToastClearRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const currentScreenRef = useRef<AppScreen>("menu");
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

  const handleSessionExitHome = useCallback(() => {
    setShowTutorial(false);
    setCurrentScreen("hub");
  }, []);

  const handleOrdersExhaustedGoHome = useCallback(() => {
    setShowTutorial(false);
    if (state?.playZone) {
      setActiveZone(state.playZone);
      setHubHighlightZone(state.playZone);
    }
    setCurrentScreen("hub");
  }, [state?.playZone]);

  const handleNoMovesExitHome = useCallback(() => {
    setShowTutorial(false);
    setCurrentScreen("hub");
    setSelectedCell(null);
    setCellMergePopIndex(null);
    setCellUnlockedFlashIndices([]);
    setCellUnlockHeavyFlash(false);
    setCellShakePair(null);
    setCoinFly(null);
  }, []);

  const handleWatchAdEnergy = useCallback(() => {
    setState((s) =>
      s ? { ...s, energy: Math.min(s.maxEnergy, s.energy + ENERGY_AD_REWARD) } : s
    );
    setRoomPurchaseToast(`+${ENERGY_AD_REWARD} энергии за просмотр рекламы`);
    if (purchaseToastClearRef.current) window.clearTimeout(purchaseToastClearRef.current);
    purchaseToastClearRef.current = window.setTimeout(() => setRoomPurchaseToast(null), 2800);
  }, []);

  /** Нет слияний, заказов, инструментов и выдачи с генератора. */
  useEffect(() => {
    if (!state || !progState || currentScreen !== "game") {
      setIsNoMoves(false);
      return;
    }
    const genMax = getGeneratorMaxCharges(progState.purchasedUpgrades);
    setIsNoMoves(
      !hasEffectiveMoves(state.grid, state.orders, state.energy, genMax, GRID_WIDTH, GRID_HEIGHT)
    );
  }, [state, progState, currentScreen]);

  /** После ремонта комнаты или редкого сбоя: снова заполнить слоты заказов, если лимит позволяет. */
  useEffect(() => {
    if (currentScreen !== "game" || !state || !progState) return;
    if (state.orders.length !== 0) return;
    const pr = progStateRef.current;
    if (!pr || !canGenerateMinigameOrder(pr, state.playZone)) return;
    setState((s) => {
      if (!s || s.orders.length !== 0) return s;
      const p = progStateRef.current;
      if (!p || !canGenerateMinigameOrder(p, s.playZone)) return s;
      const o: Order[] = [];
      const grid = s.grid;
      let guard = 0;
      while (o.length < MAX_ACTIVE_ORDERS && canGenerateMinigameOrder(p, s.playZone) && guard < 12) {
        guard += 1;
        const maxSeen = bumpMaxSeenItemLevelFromGrid(p, grid).maxSeenItemLevel;
        o.push(generateNewOrder(p.level, maxSeen, grid, s.playZone, o));
      }
      return o.length > 0 ? { ...s, orders: o } : s;
    });
  }, [
    currentScreen,
    state?.orders.length,
    state?.playZone,
    progState?.minigameOrdersAtRoomRepair,
    progState?.purchasedUpgrades,
    progState?.level,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((s) => {
        if (!s || s.energy >= s.maxEnergy) return s;
        return { ...s, energy: s.energy + 1, lastEnergyRegenAt: Date.now() };
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
      collectedItems: {},
      collectionChainRewardsClaimed: {},
      totalOrdersCompleted: 0,
      maxSeenItemLevel: 1,
      minigameOrdersAtRoomRepair: {},
    };
    const { grid: startGrid, fieldProgress: startFieldProgress } = buildFreshPlayGrid("hall");
    const initialGameState: GameState = {
      grid: startGrid,
      energy: startEnergy,
      maxEnergy: startEnergy,
      lastEnergyRegenAt: Date.now(),
      orders: createInitialOrders(startGrid, "hall", 1, 1, initialProgState),
      isFirstLaunch: true,
      playZone: "hall",
      fieldProgress: startFieldProgress,
    };
    setProgState(initialProgState);
    setState(initialGameState);
    setIsNoMoves(false);
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
          const rawProg = (parsed as { progState: ProgressionState }).progState;
          const recon = normalizeReconstructionState(rawProg.reconstruction as unknown);
          const baseProg = normalizeCollectionFields({
            ...rawProg,
            purchasedUpgrades: migrateLegacyUpgradeIds(
              Array.isArray(rawProg.purchasedUpgrades) ? rawProg.purchasedUpgrades : []
            ),
            reconstruction: recon,
            unlockedZones: mergeUnlockedZonesForLevel(
              rawProg.level,
              Array.isArray(rawProg.unlockedZones) ? rawProg.unlockedZones : ["hall"]
            ),
          });
          const hydrated = hydrateGameStateFromStorage(
            (parsed as { gameState: unknown }).gameState,
            baseProg.level,
            baseProg.maxSeenItemLevel,
            baseProg
          )!;
          setSaveLoadedFromDisk(true);
          try {
            if (!localStorage.getItem(LAST_SAVE_AT_KEY)) {
              localStorage.setItem(LAST_SAVE_AT_KEY, String(Date.now()));
            }
          } catch {
            /* ignore */
          }
          const { nextProg, energyFromChainRewards } = hydrateCollectionFromGrid(
            hydrated.grid,
            baseProg
          );
          const capped = applyEnergyCapsForProgress(hydrated, nextProg);
          setState({
            ...capped,
            energy: Math.min(capped.maxEnergy, capped.energy + energyFromChainRewards),
          });
          setProgState(nextProg);
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
        const payload = JSON.stringify({ gameState: state, progState, ordersCompleted });
        localStorage.setItem(STORAGE_KEY, payload);
        localStorage.setItem(LAST_SAVE_AT_KEY, String(Date.now()));
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
    if (currentScreen !== "game") {
      setCoinFlyBurst(null);
      setMergeBurstCellIndex(null);
    }
  }, [currentScreen]);

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

  /**
   * Второй шаг взаимодействия: пара ячеек (from → to), в основном перетаскивание.
   */
  const applyGridPairInteraction = useCallback(
    (from: number, to: number) => {
      if (!state || !progState) return;
      if (from === to) return;

      const cell = state.grid[to];
      const srcCell = state.grid[from];

      const shake = () => {
        setCellShakePair([from, to]);
        window.setTimeout(() => setCellShakePair(null), 300);
        setSelectedCell(null);
      };

      const itemAId = srcCell.item;
      const itemBId = cell.item;
      const canMerge =
        Boolean(itemAId && itemBId && itemAId === itemBId) &&
        srcCell.cellType === "item" &&
        (cell.cellType === "item" || cell.cellType === "cobweb");

      if (canMerge && itemAId) {
        const itemDef = ALL_ITEMS[itemAId];
        if (!itemDef || itemIsGenerator(itemDef) || itemIsResourcePickup(itemDef)) {
          shake();
          return;
        }
        if (cell.cellType === "cobweb" && itemDef.level !== cell.itemLevel) {
          shake();
          return;
        }
        const chain = ITEM_CHAINS[itemDef.chain];
        const nextItem = chain?.items[itemDef.level];
        if (!nextItem) {
          setSelectedCell(to);
          return;
        }

        let newGrid = [...state.grid];
        newGrid[from] = emptyGridCell();
        newGrid[to] = withSyncedItemMeta(itemGridCell(nextItem.id));
        const resultLevel = "level" in nextItem ? nextItem.level : 1;
        const opened = handleMergeFieldProgress(
          newGrid,
          state.fieldProgress,
          resultLevel,
          GRID_WIDTH,
          GRID_HEIGHT
        );
        newGrid = opened.grid;

        const manager = new ProgressionManager(progState);
        const { leveledUp: leveledFromMerge } = manager.addXp(itemDef.level);
        let progAfter = manager.getState();
        const bulk = registerCollectiblesBulk(progAfter, [nextItem.id]);
        progAfter = bulk.nextProg;

        let leveledUp = leveledFromMerge;
        if (opened.unlockedGeneratorItemId) {
          const mGen = new ProgressionManager(progAfter);
          const genUp = mGen.addXp(100);
          progAfter = mGen.getState();
          leveledUp = leveledUp || genUp.leveledUp;
          const gDef = ALL_ITEMS[opened.unlockedGeneratorItemId];
          const chId = gDef && itemIsGenerator(gDef) ? gDef.spawnsChainId : null;
          const chName = chId ? ITEM_CHAINS[chId]?.name : null;
          setRoomPurchaseToast(
            chName
              ? `🎉 Новый источник предметов! Открыт «${chName}». Предметы под паутиной обновились.`
              : "🎉 Новый источник предметов! Предметы под паутиной обновились."
          );
          window.setTimeout(() => setRoomPurchaseToast(null), 3600);
          if (opened.zoneJustCompleted) {
            window.setTimeout(() => {
              setRoomPurchaseToast(`Зона «${opened.zoneJustCompleted!.name}» полностью открыта!`);
              window.setTimeout(() => setRoomPurchaseToast(null), 3200);
            }, 3800);
          }
        } else if (opened.zoneJustCompleted) {
          setRoomPurchaseToast(`Зона «${opened.zoneJustCompleted.name}» полностью открыта!`);
          window.setTimeout(() => setRoomPurchaseToast(null), 3200);
        }
        progAfter = bumpMaxSeenItemLevelFromGrid(progAfter, newGrid);

        if (leveledUp) triggerLevelUp();

        setProgState(progAfter);
        setState({
          ...state,
          grid: newGrid,
          fieldProgress: opened.fieldProgress,
          energy: Math.min(
            state.maxEnergy,
            (leveledUp ? state.maxEnergy : state.energy) + bulk.totalEnergyFromChains
          ),
        });
        setSelectedCell(null);
        setLastAction({ type: "merge", index: to });
        updateQuestProgress("merge", 1);
        playSfx("merge_pop", 0.48);
        setMergeBurstCellIndex(to);
        window.setTimeout(() => setMergeBurstCellIndex(null), 620);
        setCellMergePopIndex(to);
        window.setTimeout(() => setCellMergePopIndex(null), 350);
        if (opened.openedCellIndices.length > 0) {
          playSfx("box_open", 0.32);
          const heavy = Boolean(opened.unlockedGeneratorItemId);
          setCellUnlockHeavyFlash(heavy);
          setCellUnlockedFlashIndices(opened.openedCellIndices);
          window.setTimeout(() => {
            setCellUnlockedFlashIndices([]);
            setCellUnlockHeavyFlash(false);
          }, heavy ? 920 : 450);
        }
        return;
      }

      if (isBlockedCellType(cell.cellType) || cell.cellType === "cobweb") {
        shake();
        return;
      }

      const newGrid = state.grid.map((c) => ({ ...c }));
      const cellA = newGrid[from];
      const cellB = newGrid[to];
      const itemA = cellA.item;
      const itemB = cellB.item;
      newGrid[from] = gridCellAfterPlacingItem(cellA, itemB);
      newGrid[to] = gridCellAfterPlacingItem(cellB, itemA);

      setState({ ...state, grid: newGrid });
      setSelectedCell(null);
    },
    [state, progState, triggerLevelUp, updateQuestProgress]
  );

  /** Автоочередь сюжета — только на экране «Дом» (не поверх меню и мини-игры). */
  useEffect(() => {
    if (!progState || currentScreen !== "hub") return;
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

  /**
   * Тап по генератору: выдача предмета. Возвращает true, если в клетке генератор
   * (включая случаи «нет энергии» / «нет пустой клетки» — без перехода к выбору слияния).
   */
  const attemptGeneratorTap = (index: number): boolean => {
    if (!state || !progState) return false;
    const cell = state.grid[index];
    const clickedId = cell.item;
    if (!clickedId) return false;
    const itemDef = ALL_ITEMS[clickedId];
    if (!itemDef || !itemIsGenerator(itemDef) || cell.cellType !== "generator") return false;

    if (state.energy <= 0) {
      setCellShakePair([index, index]);
      window.setTimeout(() => setCellShakePair(null), 300);
      return true;
    }

    const spawnIdx = pickEmptyCellForGeneratorSpawn(state.grid, index, GRID_WIDTH, GRID_HEIGHT);
    if (spawnIdx === null) {
      setCellShakePair([index, index]);
      window.setTimeout(() => setCellShakePair(null), 300);
      return true;
    }

    const chain = ITEM_CHAINS[itemDef.spawnsChainId];
    const lvl1 = chain?.items[0];
    if (!lvl1) return true;

    let spawnItemId = lvl1.id;
    if (Math.random() < GENERATOR_RESOURCE_DROP_CHANCE) {
      spawnItemId = Math.random() < 0.5 ? COIN_PICKUP_ITEM_ID : ENERGY_PICKUP_ITEM_ID;
    }

    const newGrid = [...state.grid];
    newGrid[spawnIdx] = withSyncedItemMeta(itemGridCell(spawnItemId));
    newGrid[index] = { ...cell };
    const bulk = registerCollectiblesBulk(progState, [spawnItemId]);
    playSfx("generator_tap", 0.42);
    setProgState(bumpMaxSeenItemLevelFromGrid(bulk.nextProg, newGrid));
    setState({
      ...state,
      grid: newGrid,
      energy: Math.min(state.maxEnergy, Math.max(0, state.energy - 1) + bulk.totalEnergyFromChains),
    });
    setLastAction({ type: "spawn", index: spawnIdx });
    return true;
  };

  const handleCellClick = (index: number, _shiftKey = false) => {
    if (!state || !progState) return;

    const cell = state.grid[index];

    if (isBlockedCellType(cell.cellType) || cell.cellType === "cobweb") return;

    if (selectedCell === null) {
      const clickedId = state.grid[index].item;
      if (clickedId !== null) {
        const itemDef = ALL_ITEMS[clickedId];
        if (itemDef && itemIsResourcePickup(itemDef) && isOpenCellType(cell.cellType)) {
          const newGrid = [...state.grid];
          newGrid[index] = emptyGridCell();
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
        sounds.select();
        setSelectedCell(index);
      }
    } else {
      if (selectedCell === index) {
        if (attemptGeneratorTap(index)) return;
        setSelectedCell(null);
      } else {
        const otherId = state.grid[index].item;
        if (otherId !== null) {
          sounds.select();
          setSelectedCell(index);
        } else {
          setSelectedCell(null);
          sounds.select();
        }
      }
    }
  };

  const handleCellPairDrop = useCallback(
    (from: number, to: number, _shiftKey: boolean) => {
      if (!state || !progState) return;
      applyGridPairInteraction(from, to);
    },
    [state, progState, applyGridPairInteraction]
  );

  const handleCompleteOrder = (orderId: string, orderInstanceId: string, anchorRect?: DOMRect) => {
    if (!state || !progState) return;

    type FulfilledMeta = {
      finalProg: ProgressionState;
      finalCoins: number;
      flyOrderId: string;
      orderCoinDoubled: boolean;
      anyLevelUp: boolean;
    };
    let fulfilledMeta: FulfilledMeta | null = null;
    let orderFieldOpen: MergeFieldProgressResult | null = null;

    flushSync(() => {
      setState((prev) => {
        if (!prev) return prev;
        const prog = progStateRef.current;
        if (!prog) return prev;

        const orderIndex = prev.orders.findIndex((o) => o.instanceId === orderInstanceId);
        if (orderIndex < 0) return prev;
        const order = prev.orders[orderIndex];
        if (!order || order.id !== orderId || orderIsFulfilled(order)) return prev;

        if (!orderAllRemainingSatisfiedFromGrid(prev.grid, order)) return prev;

        const clearIdx = collectIndicesForFullOrderDelivery(prev.grid, order);
        if (clearIdx.length === 0) return prev;

        const newGrid = [...prev.grid];
        for (const i of clearIdx) newGrid[i] = emptyGridCell();
        const gridAfterPickup = newGrid;

        const requiredById = new Map<string, number>();
        for (const r of order.requirements) {
          requiredById.set(r.itemId, (requiredById.get(r.itemId) ?? 0) + r.count);
        }
        const deliveredComplete: Partial<Record<string, number>> = {};
        for (const [id, c] of requiredById) {
          deliveredComplete[id] = c;
        }
        const finalized: Order = { ...order, delivered: deliveredComplete };
        if (!orderIsFulfilled(finalized)) return prev;

        const newOrders = prev.orders.filter((_, i) => i !== orderIndex);
        let afterCountProg = incrementMinigameOrderComplete(prog, prev.playZone);
        const maxSeenForOrder = bumpMaxSeenItemLevelFromGrid(afterCountProg, gridAfterPickup).maxSeenItemLevel;
        if (canGenerateMinigameOrder(afterCountProg, prev.playZone)) {
          newOrders.push(
            generateNewOrder(afterCountProg.level, maxSeenForOrder, gridAfterPickup, prev.playZone, newOrders)
          );
        }

        const manager = new ProgressionManager(afterCountProg);
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
          afterOrder.reconstruction
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

        const newTotal = (prog.totalOrdersCompleted ?? 0) + 1;
        finalProg = { ...finalProg, totalOrdersCompleted: newTotal };
        finalProg = bumpMaxSeenItemLevelFromGrid(finalProg, gridAfterPickup);

        fulfilledMeta = {
          finalProg,
          finalCoins,
          flyOrderId: order.id,
          orderCoinDoubled,
          anyLevelUp,
        };

        const fieldOrder = handleOrderFieldProgress(
          gridAfterPickup,
          prev.fieldProgress,
          GRID_WIDTH,
          GRID_HEIGHT
        );
        orderFieldOpen = fieldOrder;

        return {
          ...prev,
          grid: fieldOrder.grid,
          fieldProgress: fieldOrder.fieldProgress,
          orders: newOrders,
          energy: anyLevelUp
            ? prev.maxEnergy
            : Math.min(prev.maxEnergy, prev.energy + ENERGY_ORDER_COMPLETE_BONUS),
        };
      });
    });

    if (!fulfilledMeta) return;

    if (orderFieldOpen) {
      if (orderFieldOpen.unlockedGeneratorItemId) {
        const gDef = ALL_ITEMS[orderFieldOpen.unlockedGeneratorItemId];
        const chId = gDef && itemIsGenerator(gDef) ? gDef.spawnsChainId : null;
        const chName = chId ? ITEM_CHAINS[chId]?.name : null;
        setRoomPurchaseToast(
          chName
            ? `🎉 Новый источник предметов! Открыт «${chName}». Предметы под паутиной обновились.`
            : "🎉 Новый источник предметов! Предметы под паутиной обновились."
        );
        window.setTimeout(() => setRoomPurchaseToast(null), 3600);
        if (orderFieldOpen.zoneJustCompleted) {
          window.setTimeout(() => {
            setRoomPurchaseToast(`Зона «${orderFieldOpen.zoneJustCompleted!.name}» полностью открыта!`);
            window.setTimeout(() => setRoomPurchaseToast(null), 3200);
          }, 3800);
        }
      } else if (orderFieldOpen.zoneJustCompleted) {
        setRoomPurchaseToast(`Зона «${orderFieldOpen.zoneJustCompleted.name}» полностью открыта!`);
        window.setTimeout(() => setRoomPurchaseToast(null), 3200);
      }
      if (orderFieldOpen.openedCellIndices.length > 0) {
        const heavy = Boolean(orderFieldOpen.unlockedGeneratorItemId);
        setCellUnlockHeavyFlash(heavy);
        setCellUnlockedFlashIndices(orderFieldOpen.openedCellIndices);
        window.setTimeout(() => {
          setCellUnlockedFlashIndices([]);
          setCellUnlockHeavyFlash(false);
        }, heavy ? 920 : 450);
      }
    }

    if (fulfilledMeta.orderCoinDoubled) {
      setShowOrderCoinBonus(true);
      window.setTimeout(() => setShowOrderCoinBonus(false), 1500);
    }

    if (fulfilledMeta.anyLevelUp) {
      triggerLevelUp();
    }

    progStateRef.current = fulfilledMeta.finalProg;
    setProgState(fulfilledMeta.finalProg);
    setLastAction({ type: "order" });
    setOrdersCompleted((c) => c + 1);
    updateQuestProgress("order", 1);
    updateQuestProgress("coins", fulfilledMeta.finalCoins);
    playSfx("order_complete", 0.52);
    if (anchorRect) {
      const n = 7;
      setCoinFlyBurst({
        id: Date.now(),
        cx: anchorRect.left + anchorRect.width / 2,
        cy: anchorRect.top + anchorRect.height / 2,
        count: n,
      });
    } else {
      setCoinFly({ source: "order", orderId: fulfilledMeta.flyOrderId, amount: fulfilledMeta.finalCoins });
      window.setTimeout(() => setCoinFly(null), 800);
    }
  };

  const handleReconstructionDeliver = () => {
    if (!state || !progState) return;
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
      const u = UPGRADES.find((x) => x.id === upgradeId);
      let nextProg = newProg;
      if (u && u.effectType === "visual") {
        const az = upgradeZoneToActiveZone(u.zone);
        if (az) nextProg = resetMinigameOrdersForRoom(nextProg, az);
      }
      const bonuses = new ProgressionManager(nextProg).getActiveBonuses();
      const azForRefill =
        u && u.effectType === "visual" ? upgradeZoneToActiveZone(u.zone) : null;
      const refillGameOrders =
        Boolean(azForRefill && state.playZone === azForRefill && currentScreenRef.current === "game");
      setProgState(nextProg);
      setState((s) => {
        if (!s) return s;
        let orders = s.orders;
        if (refillGameOrders && azForRefill) {
          const o = [...s.orders];
          while (o.length < MAX_ACTIVE_ORDERS && canGenerateMinigameOrder(nextProg, s.playZone)) {
            const maxSeen = bumpMaxSeenItemLevelFromGrid(nextProg, s.grid).maxSeenItemLevel;
            o.push(generateNewOrder(nextProg.level, maxSeen, s.grid, s.playZone, o));
          }
          orders = o;
        }
        return { ...s, orders, maxEnergy: INITIAL_ENERGY + bonuses.energy_max };
      });
      updateQuestProgress("upgrade", 1);
      sounds.purchase();
      setPurchaseSparkleNonce((n) => n + 1);
      if (u && u.effectType === "visual") {
        const azDone = upgradeZoneToActiveZone(u.zone);
        if (azDone) setHubHighlightZone((hz) => (hz === azDone ? null : hz));
      }
      if (currentScreenRef.current === "room") {
        if (purchaseToastClearRef.current) {
          window.clearTimeout(purchaseToastClearRef.current);
          purchaseToastClearRef.current = null;
        }
        let toastMsg = onUpgradePurchased(upgradeId);
        if (u && u.effectType === "visual") {
          const azRoom = upgradeZoneToActiveZone(u.zone);
          const roomLabel =
            azRoom != null
              ? (HUB_ZONES.find((z) => z.id === azRoom)?.displayName ?? "комнате")
              : "комнате";
          toastMsg = `${toastMsg} Задания в «${roomLabel}» снова доступны — жми «Играть» в доме.`;
        }
        setRoomPurchaseToast(toastMsg);
        purchaseToastClearRef.current = window.setTimeout(() => {
          setRoomPurchaseToast(null);
          purchaseToastClearRef.current = null;
        }, 4500);
      }
      if (
        u &&
        u.effectType === "visual" &&
        currentScreenRef.current === "hub"
      ) {
        const az = upgradeZoneToActiveZone(u.zone);
        const roomLabel =
          az != null ? (HUB_ZONES.find((z) => z.id === az)?.displayName ?? "комнате") : "комнате";
        if (hubOrdersToastClearRef.current) {
          window.clearTimeout(hubOrdersToastClearRef.current);
          hubOrdersToastClearRef.current = null;
        }
        setHubOrdersBackToast(`Отлично! Задания в «${roomLabel}» снова доступны. Жми «Играть»!`);
        setHubPulsePlayButton(true);
        hubOrdersToastClearRef.current = window.setTimeout(() => {
          setHubOrdersBackToast(null);
          setHubPulsePlayButton(false);
          hubOrdersToastClearRef.current = null;
        }, 5000);
      }
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
    setHubHighlightZone(null);
    setHubPulsePlayButton(false);
    setCurrentScreen("game");
    if (state?.isFirstLaunch) {
      setShowTutorial(true);
    }
    setState((s) => {
      if (!s) return s;
      let next = { ...s };
      if (next.playZone !== activeZone) {
        next = { ...next, playZone: activeZone };
      }
      if (state?.isFirstLaunch) {
        next = { ...next, isFirstLaunch: false };
      }
      return next;
    });
  }, [activeZone, state?.isFirstLaunch]);

  /** Тик раз в секунду для пересчёта ms до следующей энергии на экране игры — должен быть до early return (Rules of Hooks). */
  const [gameEnergyMsTick, setGameEnergyMsTick] = useState(0);
  useEffect(() => {
    if (currentScreen !== "game") return;
    const id = window.setInterval(() => setGameEnergyMsTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [currentScreen]);

  const msUntilNextEnergy = useMemo(() => {
    if (!state || state.energy >= state.maxEnergy) return 0;
    void gameEnergyMsTick;
    const elapsed = Date.now() - state.lastEnergyRegenAt;
    return ENERGY_REGEN_INTERVAL_MS - (elapsed % ENERGY_REGEN_INTERVAL_MS);
  }, [state, gameEnergyMsTick]);

  if (!state || !progState) {
    return (
      <div
        className="app-desktop-bg-clear flex h-[100dvh] w-full flex-col items-center justify-center p-4 text-center"
        style={{ background: "var(--c-cream)", color: "var(--c-browndark)" }}
      >
        <div
          className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: "var(--c-peach2)", borderTopColor: "var(--c-rosedark)" }}
        />
        <h1 className="mb-2 text-[15px] font-medium">Загрузка игры…</h1>
        <p className="mb-4 max-w-xs text-[12px] font-medium" style={{ color: "var(--c-brown)" }}>
          Если игра не загружается, попробуйте сбросить данные.
        </p>
        <button
          type="button"
          onClick={resetGame}
          className="ds-btn-secondary w-auto min-w-[200px] border-[var(--c-rose)] text-[var(--c-rosedark)]"
        >
          Сбросить данные
        </button>
      </div>
    );
  }

  const manager = new ProgressionManager(progState);
  const xpToNextLevel = manager.getXpToNextLevel(progState.level);
  const progress = (progState.xp / xpToNextLevel) * 100;
  const hubUnlockedZones = hubUnlockedZonesForUi(devMode, progState);

  currentScreenRef.current = currentScreen;

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
            saveAgeMinutes={readSaveAgeMinutes()}
            playerLevel={progState.level}
            currentRoomName={
              HUB_ZONES.find((z) => z.id === state.playZone)?.displayName ?? "Зал"
            }
            energy={state.energy}
            maxEnergy={state.maxEnergy}
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
        <div
          className={`${screenEntering ? "screen-entering " : ""}flex min-h-0 h-[100dvh] max-h-[100dvh] w-full items-start justify-center overflow-hidden`}
        >
          <CafeHubScreen
            energy={state.energy}
            maxEnergy={state.maxEnergy}
            level={progState.level}
            coins={progState.coins}
            xpProgressPercent={progress}
            unlockedZones={hubUnlockedZones}
            purchasedUpgrades={progState.purchasedUpgrades}
            currentPlayZone={state.playZone}
            repairNudgeZone={hubHighlightZone}
            hubOrdersToast={hubOrdersBackToast}
            pulsePlayButton={hubPulsePlayButton}
            onNavigateRoom={(zone) => {
              setRoomPurchaseToast(null);
              if (purchaseToastClearRef.current) {
                window.clearTimeout(purchaseToastClearRef.current);
                purchaseToastClearRef.current = null;
              }
              if (hubHighlightZone === zone) setHubHighlightZone(null);
              setActiveZone(zone);
              setCurrentScreen("room");
            }}
            dailyQuestCompleted={questBanner.completed}
            dailyQuestTotal={questBanner.total}
            dailyUnclaimedCount={questBanner.unclaimedCount}
            onOpenDaily={() => setCurrentScreen("daily")}
            onOpenCoinShop={() => setCoinShopOpen(true)}
            onOpenCollection={() => setCurrentScreen("collection")}
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
      {currentScreen === "collection" ? (
        <div className={`${screenEntering ? "screen-entering " : ""}flex h-[100dvh] w-full items-start justify-center`}>
          <CollectionScreen progState={progState} onBack={() => setCurrentScreen("hub")} />
        </div>
      ) : null}
      {currentScreen === "daily" ? (
        <div className={`${screenEntering ? "screen-entering " : ""}flex h-[100dvh] w-full items-start justify-center`}>
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
        <div className={`${screenEntering ? "screen-entering " : ""}flex h-[100dvh] w-full items-start justify-center`}>
          <RoomScreen
            activeZone={activeZone}
            progState={progState}
            onBack={() => {
              setRoomPurchaseToast(null);
              if (purchaseToastClearRef.current) {
                window.clearTimeout(purchaseToastClearRef.current);
                purchaseToastClearRef.current = null;
              }
              setCurrentScreen("hub");
            }}
            onPurchaseUpgrade={handlePurchaseUpgrade}
            purchaseSparkleNonce={purchaseSparkleNonce}
            purchaseToast={roomPurchaseToast}
          />
        </div>
      )}
      {currentScreen === "game" && (
        <GameScreen
          state={state}
          progState={progState}
          showOrderCoinBonus={showOrderCoinBonus}
          devMode={devMode}
          msUntilNextEnergy={msUntilNextEnergy}
          xpToNextLevel={xpToNextLevel}
          selectedCell={selectedCell}
          onGoHome={() => {
            setShowTutorial(false);
            setCurrentScreen("hub");
          }}
          onCellClick={handleCellClick}
          onCellPairDrop={handleCellPairDrop}
          onCompleteOrder={handleCompleteOrder}
          onOpenTutorial={() => setShowTutorial(true)}
          mergePopIndex={cellMergePopIndex}
          cellUnlockedFlashIndices={cellUnlockedFlashIndices}
          cellUnlockHeavyFlash={cellUnlockHeavyFlash}
          cellShakePair={cellShakePair}
          coinFly={coinFly}
          mergeBurstCellIndex={mergeBurstCellIndex}
          gridWidth={GRID_WIDTH}
          gridHeight={GRID_HEIGHT}
          minigameOrdersCompletedAtRoom={minigameOrdersCompletedInRoom(progState, state.playZone)}
          maxMinigameOrdersAtRoom={maxMinigameOrdersForZone(state.playZone, progState.purchasedUpgrades)}
          ordersExhausted={
            state.orders.length === 0 && !canGenerateMinigameOrder(progState, state.playZone)
          }
          nextRepairCost={
            nextVisualRepairOffer(state.playZone, progState.purchasedUpgrades)?.cost ?? null
          }
          playerCoins={progState.coins}
          onOrdersExhaustedGoHome={handleOrdersExhaustedGoHome}
          onSessionExitHome={handleSessionExitHome}
          isNoMoves={isNoMoves}
          onNoMovesExitHome={handleNoMovesExitHome}
          onWatchAdEnergy={handleWatchAdEnergy}
        />
      )}

      {currentScreen === "hub" && currentBeat ? (
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(92,61,34,0.45)] p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              className="ds-card w-full max-w-xs p-6 text-center"
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border"
                style={{ background: "var(--c-peach)", borderColor: "var(--c-peach2)" }}
              >
                <Play className="h-7 w-7" style={{ color: "var(--c-bluedark)" }} fill="var(--c-blue)" />
              </div>
              <h2 className="mb-3 text-[15px] font-medium" style={{ color: "var(--c-browndark)" }}>
                Как играть
              </h2>
              <div className="mb-6 space-y-3 text-left text-[11px] font-medium" style={{ color: "var(--c-brown)" }}>
                <div className="flex gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ background: "var(--c-bluedark)" }}
                  >
                    1
                  </div>
                  <p>
                    Нажми на <b>корзину 🧺</b> — рядом появится предмет 1 уровня, пока на клетке есть заряды.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ background: "var(--c-bluedark)" }}
                  >
                    2
                  </div>
                  <p>
                    Объединяй <b>одинаковые</b> предметы, чтобы получить новый уровень!
                  </p>
                </div>
                <div className="flex gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ background: "var(--c-bluedark)" }}
                  >
                    3
                  </div>
                  <p>
                    Выполняй <b>Заказы</b> сверху, чтобы получать монеты и опыт.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowTutorial(false)} className="ds-btn-primary w-full">
                Понятно
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
            <div
              className="flex flex-col items-center rounded-[20px] border px-6 py-3 text-[18px] font-medium"
              style={{
                background: "var(--c-gold)",
                borderColor: "var(--c-golddark)",
                color: "var(--c-browndark)",
              }}
            >
              <Star className="mb-1 h-7 w-7 fill-current" />
              Новый уровень!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CoinFlyBurst burst={coinFlyBurst} onFinished={() => setCoinFlyBurst(null)} />
    </>
  );
}
