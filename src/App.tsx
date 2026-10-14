/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
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
  type ItemId,
  type FieldProgressState,
  type CoinFlyState,
  isOpenCellType,
  isBlockedCellType,
  itemIsGenerator,
  itemIsMergeable,
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
import { ProgressionManager, EconomyManager } from "./progressionManager";
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
import {
  initMusicPreferenceFromStorage,
  isMusicEnabled,
  playBackgroundMusicIfAllowed,
  setMusicEnabled,
  setupMusicRuntime,
} from "./utils/music";
import { playSfx } from "./utils/playSfx";
import CoinFlyBurst, { type CoinFlyBurstSpec } from "./components/CoinFlyBurst";
import { pickEmptyCellForGeneratorSpawn } from "./utils/grid";
import { randomId } from "./utils/uid";
import { hasEffectiveMoves } from "./utils/availableMoves";
import { migrateLegacyGridCell } from "./utils/gridUnlockHelpers";
import { buildInitialGrid, type BuildInitialGridResult } from "./utils/buildInitialGrid";
import {
  handleMergeFieldProgress,
  handleOrderFieldProgress,
  migrateFieldProgressFromGrid,
} from "./utils/mergeFieldProgress";
import { emptyGridCell, generatorGridCell, itemGridCell, withSyncedItemMeta } from "./utils/gridCells";
import {
  bumpMaxSeenItemLevelFromGrid,
  playerTierMaxOrderItemLevel,
  playerTierMinOrderItemLevel,
  playerTierOrderChainSliceCount,
} from "./utils/sessionGridProgress";
import {
  COINS_AD_COOLDOWN_MS,
  COINS_AD_REWARD,
  ENERGY_AD_COOLDOWN_MS,
  ENERGY_AD_REWARD,
  ENERGY_MAX_DEFAULT,
  ENERGY_ORDER_COMPLETE_BONUS,
  ENERGY_REGEN_INTERVAL_MS,
} from "./gameBalance";
import { AbstractAdService } from "./services/AbstractAdService";
import {
  upgradeZoneToActiveZone,
} from "./utils/roomOrderLimit";
import {
  canDeliverReconstructionItem,
  defaultReconstructionState,
  getCurrentReconstructionStage,
  normalizeReconstructionState,
  tickReconstructionAfterOrderComplete,
  tryCompleteReconstructionItemsStage,
  tryDeliverReconstructionItem,
} from "./reconstruction";
import { syncUnlockedGeneratorsForLevel, type AddedGeneratorFx } from "./utils/generatorProgression";

/** Бонус доступен раз в ~сутки; стрик рвётся, если игрок не заходил больше двух суток. */
const DAILY_BONUS_COOLDOWN_MS = 20 * 60 * 60 * 1000;
const DAILY_STREAK_BREAK_MS = 48 * 60 * 60 * 1000;

/**
 * День стрика для следующего получения бонуса.
 * Раньше счётчик просто рос при каждом заборе и не сбрасывался при пропусках,
 * то есть «7 дней подряд» можно было собрать с любыми перерывами.
 */
function dailyStreakDayForNextClaim(lastClaimAt: number | null, now: number): number {
  const stored = Number(localStorage.getItem(DAILY_STREAK_KEY) || "0");
  const prevDay = Number.isFinite(stored) ? Math.min(7, Math.max(0, Math.floor(stored))) : 0;
  if (lastClaimAt == null || now - lastClaimAt > DAILY_STREAK_BREAK_MS) return 1;
  return prevDay >= 7 ? 1 : prevDay + 1;
}

const SHOWN_BEATS_KEY = "shownBeats";
const LAST_DAILY_BONUS_KEY = "lastDailyBonus";
const DAILY_STREAK_KEY = "dailyStreak";
const SHOWN_UPGRADE_HINTS_KEY = "shownUpgradeHints";
const SHOWN_ROOM_HINTS_KEY = "shownRoomHints";
const adService = new AbstractAdService();

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
function gridCellAfterPlacingItem(newItem: string | null): GridCell {
  if (!newItem) {
    return emptyGridCell();
  }
  const d = ALL_ITEMS[newItem];
  if (d && itemIsGenerator(d)) {
    return generatorGridCell(newItem);
  }
  return withSyncedItemMeta(itemGridCell(newItem));
}

/** Два тапа сливают предметы только если это реально слияние; обмен местами остаётся за драгом. */
function canMergeGridPair(grid: GridCell[], from: number, to: number): boolean {
  if (from === to) return false;
  const a = grid[from];
  const b = grid[to];
  if (!a || !b || !a.item || a.item !== b.item) return false;
  if (a.cellType !== "item") return false;
  if (b.cellType !== "item" && b.cellType !== "cobweb") return false;
  const def = ALL_ITEMS[a.item];
  if (!def || !itemIsMergeable(def)) return false;
  if (b.cellType === "cobweb" && def.level !== b.itemLevel) return false;
  return Boolean(ITEM_CHAINS[def.chain]?.items[def.level]);
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

/**
 * Реген энергии по времени, а не по тикам таймера: работает и пока вкладка закрыта,
 * и когда браузер тормозит фоновые интервалы. `lastEnergyRegenAt` двигаем ровно на
 * начисленные интервалы, чтобы остаток времени не терялся.
 */
function withEnergyRegenFromClock(gs: GameState, now = Date.now()): GameState {
  if (gs.energy >= gs.maxEnergy) {
    // Полная шкала: держим точку отсчёта свежей, иначе после первой траты
    // «до следующей» покажет случайный остаток от давнего таймстампа.
    if (now - gs.lastEnergyRegenAt < ENERGY_REGEN_INTERVAL_MS) return gs;
    return { ...gs, lastEnergyRegenAt: now };
  }
  const elapsed = now - gs.lastEnergyRegenAt;
  if (elapsed < ENERGY_REGEN_INTERVAL_MS) return gs;
  const gained = Math.floor(elapsed / ENERGY_REGEN_INTERVAL_MS);
  const energy = Math.min(gs.maxEnergy, gs.energy + gained);
  return {
    ...gs,
    energy,
    lastEnergyRegenAt:
      energy >= gs.maxEnergy ? now : gs.lastEnergyRegenAt + gained * ENERGY_REGEN_INTERVAL_MS,
  };
}

function mergeableItemsInChain(chain: ItemChain): MergeableItemDefinition[] {
  return chain.items.filter(
    (it): it is MergeableItemDefinition =>
      !itemIsGenerator(it) && !itemIsResourcePickup(it) && "level" in it
  );
}

type OrderComplexity = "simple" | "medium" | "hard";

function pickOrderComplexity(playerLevel: number): OrderComplexity {
  const roll = Math.random();
  if (playerLevel < 5) return roll < 0.75 ? "simple" : "medium";
  if (playerLevel < 10) return roll < 0.55 ? "simple" : roll < 0.95 ? "medium" : "hard";
  if (playerLevel < 15) return roll < 0.35 ? "simple" : roll < 0.85 ? "medium" : "hard";
  return roll < 0.2 ? "simple" : roll < 0.7 ? "medium" : "hard";
}

function nextAvailableVisualUpgrade(prog: Pick<ProgressionState, "level" | "purchasedUpgrades" | "unlockedZones">): {
  id: string;
  cost: number;
  name: string;
} | null {
  const candidates = UPGRADES.filter((u) => {
    if (u.effectType !== "visual") return false;
    if (prog.purchasedUpgrades.includes(u.id)) return false;
    if (prog.level < u.requiredLevel) return false;
    if (u.zone !== "meta" && !prog.unlockedZones.includes(u.zone)) return false;
    return true;
  }).sort((a, b) => a.cost - b.cost || a.requiredLevel - b.requiredLevel);
  const first = candidates[0];
  return first ? { id: first.id, cost: first.cost, name: first.name } : null;
}

/**
 * Пул предметов, из которых можно собрать заказ текущей сессии.
 * Единственный источник правды для `buildRandomSessionOrder` и подсчёта слотов —
 * раньше этот расчёт был скопирован в две функции слово в слово.
 */
function sessionOrderCandidatePool(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone
): { ids: ItemId[]; chainsBase: ItemChain[]; allowedMinLevel: number; allowedMaxLevel: number } {
  const chainsFromGens = chainsFromGridGenerators(grid);
  const chainsBase =
    chainsFromGens.length > 0 ? chainsFromGens : [ITEM_CHAINS[mergeChainIdForZone(zone)] ?? ITEM_CHAINS.hall_tea];

  const tierMaxCap = playerTierMaxOrderItemLevel(level);
  /** На 1 уровень выше максимума «видел на поле» — стимул к слияниям; не выше потолка по уровню игрока. */
  const orderMaxLevel = Math.min(Math.max(1, maxSeenItemLevel) + 1, tierMaxCap);
  const orderMinLevel = playerTierMinOrderItemLevel(level);
  const allowedMinLevel = Math.max(1, Math.min(orderMinLevel, orderMaxLevel));
  const allowedMaxLevel = Math.max(allowedMinLevel, orderMaxLevel);

  const spawnChainIds = new Set(chainsBase.map((c) => c.id));
  const candidateIds = new Set<ItemId>();

  const levelOnCell = (cell: GridCell, def: MergeableItemDefinition): number =>
    cell.cellType === "cobweb" ? Math.max(1, cell.itemLevel) : def.level;

  for (const c of grid) {
    if (c.cellType !== "item" && c.cellType !== "cobweb") continue;
    if (!c.item || isCobwebUnknownPlaceholder(c)) continue;
    const d = ALL_ITEMS[c.item];
    if (!d || !itemIsMergeable(d)) continue;
    const lv = levelOnCell(c, d);
    if (lv < allowedMinLevel || lv > allowedMaxLevel) continue;
    candidateIds.add(c.item);
  }

  for (const ch of chainsBase) {
    for (const it of mergeableItemsInChain(ch)) {
      if (it.level >= allowedMinLevel && it.level <= allowedMaxLevel) candidateIds.add(it.id);
    }
  }

  const chainSlice = playerTierOrderChainSliceCount(level, chainsBase.length);
  const allowedChainIds = new Set(chainsBase.slice(0, Math.max(1, chainSlice)).map((c) => c.id));

  for (const id of [...candidateIds]) {
    const d = ALL_ITEMS[id];
    if (!d || !itemIsMergeable(d)) continue;
    const onGrid = grid.some((cell) => {
      if (cell.item !== id || (cell.cellType !== "item" && cell.cellType !== "cobweb")) return false;
      const lv = levelOnCell(cell, d);
      return lv >= allowedMinLevel && lv <= allowedMaxLevel;
    });
    const spawnable =
      d.level >= allowedMinLevel &&
      d.level <= allowedMaxLevel &&
      spawnChainIds.has(d.chain) &&
      allowedChainIds.has(d.chain);
    if (!onGrid && !spawnable) candidateIds.delete(id);
  }

  return { ids: [...candidateIds], chainsBase, allowedMinLevel, allowedMaxLevel };
}

/** Портрет, которого ещё нет среди активных заказов (иначе на экране два одинаковых гостя). */
function pickCustomerAvatar(existing: Order[]): string {
  const used = new Set(existing.map((o) => resolveOrderCustomerAvatar(o)));
  const free = ORDER_CUSTOMER_AVATAR_PATHS.filter((p) => !used.has(p));
  const pool = free.length > 0 ? free : ORDER_CUSTOMER_AVATAR_PATHS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function buildRandomSessionOrder(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone,
  orderId: string,
  existingOrders: Order[] = []
): Order {
  const { ids: candidateIds, chainsBase, allowedMinLevel, allowedMaxLevel } = sessionOrderCandidatePool(
    level,
    maxSeenItemLevel,
    grid,
    zone
  );

  const poolShuffled = [...candidateIds].sort(() => Math.random() - 0.5);
  const complexity = pickOrderComplexity(level);
  const requirements: OrderRequirement[] = [];
  const desiredSlots = complexity === "simple" ? 1 : complexity === "medium" ? (Math.random() < 0.68 ? 1 : 2) : Math.random() < 0.6 ? 2 : 3;

  for (const id of poolShuffled) {
    if (requirements.length >= desiredSlots) break;
    if (requirements.some((r) => r.itemId === id)) continue;
    const count = complexity === "hard" ? (Math.random() < 0.45 ? 2 : 1) : complexity === "medium" ? (Math.random() < 0.22 ? 2 : 1) : 1;
    requirements.push({ itemId: id, count });
  }

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
    const mergeables = mergeableItemsInChain(ITEM_CHAINS.hall_tea);
    const pick =
      mergeables.find((x) => x.level >= allowedMinLevel && x.level <= allowedMaxLevel) ??
      mergeables.filter((x) => x.level <= allowedMaxLevel).at(-1) ??
      mergeables[0];
    if (pick) requirements.push({ itemId: pick.id, count: 1 });
  }
  if (requirements.length === 0) {
    requirements.push({ itemId: mergeableItemsInChain(ITEM_CHAINS.hall_tea)[0]?.id ?? "hl1", count: 1 });
  }

  const difficulty = complexity;
  const base = EconomyManager.calculateOrderReward(difficulty);
  const totalUnits = requirements.reduce((s, q) => s + q.count, 0);
  const complexityMult = difficulty === "simple" ? 1 : difficulty === "medium" ? 1.6 : 2.4;
  const mult = complexityMult + 0.2 * (totalUnits - 1) + 0.1 * (requirements.length - 1);
  const rewardCoins = Math.round(base.coins * mult);
  const rewardXp = Math.round(base.xp * mult);
  const customerAvatar = pickCustomerAvatar(existingOrders);

  return {
    id: orderId,
    instanceId: randomId(),
    requirements,
    delivered: {},
    rewardCoins,
    rewardXp,
    customerAvatar,
  };
}

/**
 * Сколько заказов держать активными. Слотов не больше, чем различных предметов в пуле:
 * на 1 уровне пул — всего 2 предмета (ур. 1 и 2), и три карточки просили один и тот же чайник.
 */
function activeOrderSlotsForPool(poolSize: number): number {
  return Math.max(1, Math.min(MAX_ACTIVE_ORDERS, poolSize));
}

function activeOrderSlots(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone
): number {
  return activeOrderSlotsForPool(
    eligibleMergeableItemIdsForSessionOrder(level, maxSeenItemLevel, grid, zone).length
  );
}

function collectOrderItemIds(order: Order): Set<string> {
  const s = new Set<string>();
  for (const r of order.requirements) s.add(r.itemId);
  return s;
}

/** Один и тот же itemId не может быть в двух активных заказах одновременно. */
function orderConflictsWithExisting(candidate: Order, existing: Order[]): boolean {
  const cIds = collectOrderItemIds(candidate);
  return existing.some((o) => {
    const oIds = collectOrderItemIds(o);
    for (const id of cIds) {
      if (oIds.has(id)) return true;
    }
    return false;
  });
}

function eligibleMergeableItemIdsForSessionOrder(
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone
): ItemId[] {
  return sessionOrderCandidatePool(level, maxSeenItemLevel, grid, zone).ids;
}

function patchOrderRewardsFromRequirements(order: Order): Order {
  const complexity: OrderComplexity =
    order.requirements.length >= 3 ? "hard" : order.requirements.length === 2 ? "medium" : "simple";
  const base = EconomyManager.calculateOrderReward(complexity);
  const totalUnits = order.requirements.reduce((s, q) => s + q.count, 0);
  const complexityMult = complexity === "simple" ? 1 : complexity === "medium" ? 1.6 : 2.4;
  const mult = complexityMult + 0.2 * (totalUnits - 1) + 0.1 * (order.requirements.length - 1);
  return {
    ...order,
    rewardCoins: Math.round(base.coins * mult),
    rewardXp: Math.round(base.xp * mult),
  };
}

function forceUniqueOrderAgainstExisting(
  order: Order,
  existing: Order[],
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone
): Order {
  const used = new Set<string>();
  for (const o of existing) {
    for (const id of collectOrderItemIds(o)) used.add(id);
  }

  const pool = eligibleMergeableItemIdsForSessionOrder(level, maxSeenItemLevel, grid, zone).filter((id) => !used.has(id));
  const poolShuffled = [...pool].sort(() => Math.random() - 0.5);

  let pi = 0;
  const nextReq = order.requirements.map((r) => ({ ...r }));
  for (let i = 0; i < nextReq.length; i++) {
    const id = nextReq[i].itemId;
    if (!used.has(id)) {
      used.add(id);
      continue;
    }
    while (pi < poolShuffled.length && used.has(poolShuffled[pi]!)) pi += 1;
    const repl = poolShuffled[pi];
    if (!repl) break;
    nextReq[i] = { ...nextReq[i], itemId: repl };
    used.add(repl);
    pi += 1;
  }

  let next: Order = { ...order, requirements: nextReq };
  next = patchOrderRewardsFromRequirements(next);
  return next;
}

/** Починить уже сохранённые заказы: убрать пересечения itemId между активными заказами. */
function repairActiveOrdersUniqueItemIds(
  orders: Order[],
  level: number,
  maxSeenItemLevel: number,
  grid: GridCell[],
  zone: ActiveZone
): Order[] {
  const out: Order[] = [];
  for (let i = 0; i < orders.length; i++) {
    let o = orders[i];
    if (!o) continue;
    const prev = out;
    if (orderConflictsWithExisting(o, prev)) {
      o = forceUniqueOrderAgainstExisting(o, prev, level, maxSeenItemLevel, grid, zone);
    }
    out.push(o);
  }
  return out;
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
  let order = buildRandomSessionOrder(level, maxSeenItemLevel, grid, zone, orderId, existing);
  while (attempts < 22 && orderConflictsWithExisting(order, existing)) {
    attempts += 1;
    order = buildRandomSessionOrder(level, maxSeenItemLevel, grid, zone, `${orderId}_u${attempts}`, existing);
  }
  if (orderConflictsWithExisting(order, existing)) {
    order = forceUniqueOrderAgainstExisting(order, existing, level, maxSeenItemLevel, grid, zone);
  }
  return order;
}

function createInitialOrders(
  grid: GridCell[],
  zone: ActiveZone,
  level: number,
  maxSeenItemLevel: number
): Order[] {
  const slots = activeOrderSlots(level, maxSeenItemLevel, grid, zone);
  const out: Order[] = [];
  let i = 0;
  while (out.length < slots) {
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
        const req: OrderRequirement =
          itemLevel !== undefined ? { itemId, count, itemLevel } : { itemId, count };
        return req;
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
    typeof r.instanceId === "string" && r.instanceId.length > 0 ? r.instanceId : randomId();

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
    "purchasedUpgrades" | "level" | "totalOrdersCompleted"
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
      const limitProg: Pick<ProgressionState, "purchasedUpgrades" | "level" | "totalOrdersCompleted"> =
        progForOrderLimit ?? { level: defaultLevel, purchasedUpgrades: [], totalOrdersCompleted: 0 };
      const slots = activeOrderSlots(limitProg.level, maxSeenItemLevel, grid, inferredZone);
      let o =
        rawO.length > 0 ? rawO : createInitialOrders(grid, inferredZone, defaultLevel, maxSeenItemLevel);
      o = repairActiveOrdersUniqueItemIds(o, limitProg.level, maxSeenItemLevel, grid, inferredZone);
      let guard = 0;
      while (o.length < slots && guard < 12) {
        guard += 1;
        o.push(generateNewOrder(limitProg.level, maxSeenItemLevel, grid, inferredZone, o));
      }
      return o.slice(0, slots);
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
  const [currentBeat, setCurrentBeat] = useState<StoryBeat | null>(null);
  const [shownBeats, setShownBeats] = useState<string[]>([]);
  const [ordersCompleted, setOrdersCompleted] = useState(0);
  const [showDailyBonus, setShowDailyBonus] = useState(false);
  const [dailyBonusDay, setDailyBonusDay] = useState(1);
  const [dailyQuests, setDailyQuests] = useState<DailyQuestsState>(() => loadDailyQuests());
  const [cellMergePopIndex, setCellMergePopIndex] = useState<number | null>(null);
  /** Индексы соседей, только что очищенных от препятствия после merge (краткая анимация). */
  const [cellUnlockedFlashIndices, setCellUnlockedFlashIndices] = useState<number[]>([]);
  /** Новые генераторы, появившиеся на поле по уровню (краткая анимация появления в клетке). */
  const [generatorAppearIndices, setGeneratorAppearIndices] = useState<number[]>([]);
  const [generatorUnlockFx, setGeneratorUnlockFx] = useState<(AddedGeneratorFx & { fxId: number }) | null>(null);
  /** Усиленная вспышка при открытии ящика с генератором. */
  const [cellUnlockHeavyFlash, setCellUnlockHeavyFlash] = useState(false);
  const [cellShakePair, setCellShakePair] = useState<[number, number] | null>(null);
  const [coinFly, setCoinFly] = useState<CoinFlyState | null>(null);
  const [coinFlyBurst, setCoinFlyBurst] = useState<CoinFlyBurstSpec | null>(null);
  const [mergeBurstCellIndex, setMergeBurstCellIndex] = useState<number | null>(null);
  /** Клетка, куда предмет упал бесплатно (апгрейд `free_spawn_chance`) — короткий бейдж «бесплатно». */
  const [freeSpawnFlashIndex, setFreeSpawnFlashIndex] = useState<number | null>(null);
  /** Нет эффективных ходов (слияние / заказ / спавн при энергии); UI мягкий, ввод не блокируем. */
  const [isNoMoves, setIsNoMoves] = useState(false);
  const [purchaseSparkleNonce, setPurchaseSparkleNonce] = useState(0);
  const [roomPurchaseToast, setRoomPurchaseToast] = useState<string | null>(null);
  const purchaseToastClearRef = useRef<number | null>(null);
  const [hubOrdersBackToast, setHubOrdersBackToast] = useState<string | null>(null);
  const [hubPulsePlayButton, setHubPulsePlayButton] = useState(false);
  const hubOrdersToastClearRef = useRef<number | null>(null);
  const currentScreenRef = useRef<AppScreen>("menu");
  const [coinShopOpen, setCoinShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastCoinsAdAt, setLastCoinsAdAt] = useState(0);
  const [lastEnergyAdAt, setLastEnergyAdAt] = useState(0);
  const [roomAdTick, setRoomAdTick] = useState(0);
  /** Была успешная загрузка из STORAGE_KEY при старте приложения. */
  const [saveLoadedFromDisk, setSaveLoadedFromDisk] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [screenEntering, setScreenEntering] = useState(false);
  const skipScreenTransitionRef = useRef(true);
  const [lenaHint, setLenaHint] = useState<{ id: number; text: string } | null>(null);
  const [shownUpgradeHints, setShownUpgradeHints] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SHOWN_UPGRADE_HINTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [shownRoomHints, setShownRoomHints] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SHOWN_ROOM_HINTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const lastLenaHintAtRef = useRef(0);
  const affordEdgeUpgradeIdRef = useRef<string | null>(null);
  const prevUnlockedZonesRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (!lenaHint) return;
    const timer = window.setTimeout(() => {
      setLenaHint((cur) => (cur?.id === lenaHint.id ? null : cur));
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [lenaHint]);

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

  /**
   * Награда за рекламу: энергия. Раньше кнопка просто прибавляла +15 без показа рекламы
   * и без кулдауна — то есть давала бесконечную энергию в один клик.
   */
  const handleWatchAdEnergy = useCallback(async () => {
    const showToast = (text: string) => {
      setRoomPurchaseToast(text);
      if (purchaseToastClearRef.current) window.clearTimeout(purchaseToastClearRef.current);
      purchaseToastClearRef.current = window.setTimeout(() => setRoomPurchaseToast(null), 2800);
    };

    const remaining = lastEnergyAdAt <= 0 ? 0 : ENERGY_AD_COOLDOWN_MS - (Date.now() - lastEnergyAdAt);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      showToast(`Реклама будет доступна через ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`);
      return;
    }

    const shown = await adService.showRewarded(() => {
      setState((s) => (s ? { ...s, energy: Math.min(s.maxEnergy, s.energy + ENERGY_AD_REWARD) } : s));
      setLastEnergyAdAt(Date.now());
      showToast(`+${ENERGY_AD_REWARD} энергии за просмотр рекламы`);
    });
    if (!shown) showToast("Реклама сейчас недоступна. Попробуйте чуть позже.");
  }, [lastEnergyAdAt]);

  useEffect(() => {
    if (currentScreen !== "room") return;
    const id = window.setInterval(() => setRoomAdTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [currentScreen]);

  const coinsAdCooldownMs = useMemo(() => {
    void roomAdTick;
    if (lastCoinsAdAt <= 0) return 0;
    return Math.max(0, COINS_AD_COOLDOWN_MS - (Date.now() - lastCoinsAdAt));
  }, [lastCoinsAdAt, roomAdTick]);

  const nextVisualUpgradeOffer = useMemo(
    () =>
      progState
        ? nextAvailableVisualUpgrade({
            level: progState.level,
            purchasedUpgrades: progState.purchasedUpgrades,
            unlockedZones: progState.unlockedZones,
          })
        : null,
    [progState?.level, progState?.purchasedUpgrades, progState?.unlockedZones]
  );

  useEffect(() => {
    try {
      localStorage.setItem(SHOWN_UPGRADE_HINTS_KEY, JSON.stringify(shownUpgradeHints));
    } catch {
      /* ignore */
    }
  }, [shownUpgradeHints]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOWN_ROOM_HINTS_KEY, JSON.stringify(shownRoomHints));
    } catch {
      /* ignore */
    }
  }, [shownRoomHints]);

  const pushRoomToast = useCallback((message: string, ttlMs = 2800) => {
    setRoomPurchaseToast(message);
    if (purchaseToastClearRef.current) window.clearTimeout(purchaseToastClearRef.current);
    purchaseToastClearRef.current = window.setTimeout(() => setRoomPurchaseToast(null), ttlMs);
  }, []);

  const handleWatchAdCoins = useCallback(async () => {
    if (coinsAdCooldownMs > 0) {
      const seconds = Math.ceil(coinsAdCooldownMs / 1000);
      const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      pushRoomToast(`Реклама будет доступна через ${label}`);
      return;
    }
    const shown = await adService.showRewarded(() => {
      setProgState((ps) => {
        if (!ps) return ps;
        const m = new ProgressionManager(ps);
        m.addCoins(COINS_AD_REWARD);
        return m.getState();
      });
      setLastCoinsAdAt(Date.now());
      pushRoomToast(`+${COINS_AD_REWARD} монет за просмотр рекламы`);
    });
    if (!shown) {
      pushRoomToast("Реклама сейчас недоступна. Попробуйте чуть позже.");
    }
  }, [coinsAdCooldownMs, pushRoomToast]);

  /** Нет слияний, заказов, инструментов и выдачи с генератора. */
  useEffect(() => {
    if (!state || !progState || currentScreen !== "game") {
      setIsNoMoves(false);
      return;
    }
    setIsNoMoves(!hasEffectiveMoves(state.grid, state.orders, state.energy));
  }, [state, progState, currentScreen]);

  /** Единое поле: генераторы комнат появляются на поле по уровню открытия комнаты. */
  useEffect(() => {
    if (!state || !progState) return;
    const result = syncUnlockedGeneratorsForLevel(state.grid, GRID_WIDTH, GRID_HEIGHT, progState.level);
    if (result.added.length === 0) return;
    setState((s) => (s ? { ...s, grid: result.grid } : s));
    const first = result.added[0];
    if (first) {
      setGeneratorUnlockFx({ ...first, fxId: Date.now() });
      setGeneratorAppearIndices([first.targetIndex]);
      window.setTimeout(() => setGeneratorAppearIndices([]), 1500);
      setLenaHint({ id: Date.now(), text: `Поздравляю! Новый генератор «${first.name}» уже на поле.` });
    }
  }, [state?.grid, progState?.level]);

  useEffect(() => {
    if (!progState || currentScreen !== "game" || !nextVisualUpgradeOffer) {
      affordEdgeUpgradeIdRef.current = null;
      return;
    }
    const canAfford = progState.coins >= nextVisualUpgradeOffer.cost;
    if (!canAfford) {
      if (affordEdgeUpgradeIdRef.current === nextVisualUpgradeOffer.id) {
        affordEdgeUpgradeIdRef.current = null;
      }
      return;
    }
    if (affordEdgeUpgradeIdRef.current === nextVisualUpgradeOffer.id) return;
    affordEdgeUpgradeIdRef.current = nextVisualUpgradeOffer.id;
    if (shownUpgradeHints.includes(nextVisualUpgradeOffer.id)) return;
    const now = Date.now();
    if (now - lastLenaHintAtRef.current < 120000) return;
    if (Math.random() > 0.45) return;
    setShownUpgradeHints((prev) => [...prev, nextVisualUpgradeOffer.id]);
    lastLenaHintAtRef.current = now;
    setLenaHint({ id: now, text: `Теперь мы можем купить «${nextVisualUpgradeOffer.name}» в Доме.` });
  }, [
    currentScreen,
    progState?.coins,
    nextVisualUpgradeOffer?.id,
    nextVisualUpgradeOffer?.cost,
    nextVisualUpgradeOffer?.name,
    shownUpgradeHints,
  ]);

  useEffect(() => {
    if (!progState) return;
    if (prevUnlockedZonesRef.current === null) {
      prevUnlockedZonesRef.current = [...progState.unlockedZones];
      return;
    }
    const prev = new Set(prevUnlockedZonesRef.current);
    const fresh = progState.unlockedZones.filter((z) => !prev.has(z));
    prevUnlockedZonesRef.current = [...progState.unlockedZones];
    const nextZone = fresh.find((z) => !shownRoomHints.includes(z));
    if (!nextZone) return;
    const zoneName = HUB_ZONES.find((z) => progressZoneId(z.id) === nextZone)?.displayName ?? "новая комната";
    setShownRoomHints((prevHints) => [...prevHints, nextZone]);
    const now = Date.now();
    lastLenaHintAtRef.current = now;
    setLenaHint({ id: now, text: `Открылась «${zoneName}». Заглянем в Дом и посмотрим!` });
  }, [progState?.unlockedZones, shownRoomHints]);

  /**
   * Держим число заказов равным числу доступных слотов.
   *
   * Слоты растут вместе с пулом предметов (`maxSeenItemLevel`), но пересчитывались только
   * при сдаче заказа. Если игрок дошёл до состояния, где заказов меньше слотов, и ни одного
   * не может выполнить, — их число так и оставалось заниженным. Здесь добираем недостающие.
   */
  useEffect(() => {
    if (currentScreen !== "game" || !state || !progState) return;
    const maxSeenNow = bumpMaxSeenItemLevelFromGrid(progState, state.grid).maxSeenItemLevel;
    const slotsNow = activeOrderSlots(progState.level, maxSeenNow, state.grid, state.playZone);
    if (state.orders.length >= slotsNow) return;

    setState((s) => {
      if (!s) return s;
      const p = progStateRef.current;
      if (!p) return s;
      const grid = s.grid;
      const maxSeen = bumpMaxSeenItemLevelFromGrid(p, grid).maxSeenItemLevel;
      const slots = activeOrderSlots(p.level, maxSeen, grid, s.playZone);
      if (s.orders.length >= slots) return s;
      const o = [...s.orders];
      let guard = 0;
      while (o.length < slots && guard < 12) {
        guard += 1;
        o.push(generateNewOrder(p.level, maxSeen, grid, s.playZone, o));
      }
      return o.length > s.orders.length ? { ...s, orders: o } : s;
    });
  }, [
    currentScreen,
    state?.orders.length,
    state?.playZone,
    state?.grid,
    progState?.level,
    progState?.maxSeenItemLevel,
  ]);

  /** Реген считаем от часов, поэтому тикаем часто и дёшево — обновление стейта только когда что-то начислилось. */
  useEffect(() => {
    const tick = () => setState((s) => (s ? withEnergyRegenFromClock(s) : s));
    const id = window.setInterval(tick, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    };
    const { grid: startGrid, fieldProgress: startFieldProgress } = buildFreshPlayGrid("hall");
    const initialGameState: GameState = {
      grid: startGrid,
      energy: startEnergy,
      maxEnergy: startEnergy,
      lastEnergyRegenAt: Date.now(),
      orders: createInitialOrders(startGrid, "hall", 1, 1),
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
          // Энергия, накопленная пока игра была закрыта.
          const withOfflineEnergy = withEnergyRegenFromClock({
            ...capped,
            energy: Math.min(capped.maxEnergy, capped.energy + energyFromChainRewards),
          });
          setState(withOfflineEnergy);
          setProgState(nextProg);
          setOrdersCompleted(
            typeof (parsed as { ordersCompleted?: unknown }).ordersCompleted === "number"
              ? (parsed as { ordersCompleted: number }).ordersCompleted
              : 0
          );
          setShownBeats(sb);
          const lastBonusRaw = localStorage.getItem(LAST_DAILY_BONUS_KEY);
          setDailyBonusDay(
            dailyStreakDayForNextClaim(lastBonusRaw ? Number(lastBonusRaw) : null, Date.now())
          );
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
    initMusicPreferenceFromStorage();
    setMusicOn(isMusicEnabled());
    setupMusicRuntime();
    void playBackgroundMusicIfAllowed();
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
        const mergeBonuses = new ProgressionManager(progState).getActiveBonuses();
        const opened = handleMergeFieldProgress(
          newGrid,
          state.fieldProgress,
          resultLevel,
          GRID_WIDTH,
          GRID_HEIGHT,
          mergeBonuses.box_loot_chance
        );
        newGrid = opened.grid;

        const manager = new ProgressionManager(progState);
        const { leveledUp: leveledFromMerge } = manager.addXp(itemDef.level);
        let progAfter = manager.getState();
        const bulk = registerCollectiblesBulk(progAfter, [nextItem.id]);
        progAfter = bulk.nextProg;

        // Апгрейд «находки в ящиках»: бонусные монеты за открытый ящик.
        if (opened.bonusLootCoins > 0) {
          const mLoot = new ProgressionManager(progAfter);
          mLoot.addCoins(opened.bonusLootCoins);
          progAfter = mLoot.getState();
          updateQuestProgress("coins", opened.bonusLootCoins);
          pushRoomToast(`В ящике нашлись ${opened.bonusLootCoins} монет!`, 2200);
        }

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
      newGrid[from] = gridCellAfterPlacingItem(itemB);
      newGrid[to] = gridCellAfterPlacingItem(itemA);

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
    // Диалог Лены и модалка бонуса не должны наезжать друг на друга.
    if (currentBeat) return;
    const last = localStorage.getItem(LAST_DAILY_BONUS_KEY);
    const now = Date.now();
    if (last && now - Number(last) <= DAILY_BONUS_COOLDOWN_MS) return;
    setDailyBonusDay(dailyStreakDayForNextClaim(last ? Number(last) : null, now));
    setShowDailyBonus(true);
  }, [currentScreen, progState, currentBeat]);

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

    // Апгрейд «бесплатный спавн»: с шансом free_spawn_chance энергия не тратится.
    const freeSpawn = Math.random() < new ProgressionManager(progState).getActiveBonuses().free_spawn_chance;
    const energyCost = freeSpawn ? 0 : 1;

    setProgState(bumpMaxSeenItemLevelFromGrid(bulk.nextProg, newGrid));
    const nextEnergy = Math.min(
      state.maxEnergy,
      Math.max(0, state.energy - energyCost) + bulk.totalEnergyFromChains
    );
    setState({
      ...state,
      grid: newGrid,
      energy: nextEnergy,
      // Первая трата с полной шкалы запускает отсчёт до +1 с нуля,
      // иначе таймер унаследовал бы произвольный остаток от старой точки отсчёта.
      lastEnergyRegenAt:
        state.energy >= state.maxEnergy && nextEnergy < state.maxEnergy
          ? Date.now()
          : state.lastEnergyRegenAt,
    });
    if (freeSpawn) {
      setFreeSpawnFlashIndex(spawnIdx);
      window.setTimeout(() => setFreeSpawnFlashIndex((cur) => (cur === spawnIdx ? null : cur)), 900);
    }
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
      } else if (canMergeGridPair(state.grid, selectedCell, index)) {
        // Тап-в-тап слияние: раньше второй тап просто переносил выделение,
        // из-за чего слить предметы можно было только перетаскиванием
        // (и совсем нельзя — с клавиатуры).
        applyGridPairInteraction(selectedCell, index);
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

  /**
   * Сдача заказа. Считаем всё заранее по текущему состоянию и только потом пишем стейт:
   * раньше вычисления жили внутри апдейтера `setState`, который React вправе вызвать повторно
   * (StrictMode, прерванный конкурентный рендер) — из-за этого дублировался прогресс квестов.
   */
  const handleCompleteOrder = (orderId: string, orderInstanceId: string, anchorRect?: DOMRect) => {
    if (!state || !progState) return;

    const prev = state;
    const prog = progState;

    const orderIndex = prev.orders.findIndex((o) => o.instanceId === orderInstanceId);
    if (orderIndex < 0) return;
    const order = prev.orders[orderIndex];
    if (!order || order.id !== orderId || orderIsFulfilled(order)) return;
    if (!orderAllRemainingSatisfiedFromGrid(prev.grid, prev.orders, orderIndex)) return;

    const clearIdx = collectIndicesForFullOrderDelivery(prev.grid, prev.orders, orderIndex);
    if (clearIdx.length === 0) return;

    const gridAfterPickup = [...prev.grid];
    for (const i of clearIdx) gridAfterPickup[i] = emptyGridCell();

    const newOrders = prev.orders.filter((_, i) => i !== orderIndex);
    const maxSeenForOrder = bumpMaxSeenItemLevelFromGrid(prog, gridAfterPickup).maxSeenItemLevel;
    const orderSlots = activeOrderSlots(prog.level, maxSeenForOrder, gridAfterPickup, prev.playZone);
    let refillGuard = 0;
    while (newOrders.length < orderSlots && refillGuard < 12) {
      refillGuard += 1;
      newOrders.push(generateNewOrder(prog.level, maxSeenForOrder, gridAfterPickup, prev.playZone, newOrders));
    }

    const manager = new ProgressionManager(prog);
    const orderBonuses = manager.getActiveBonuses();

    let finalCoins = Math.round(order.rewardCoins * (1 + orderBonuses.income_bonus));
    let orderCoinDoubled = false;
    if (Math.random() < orderBonuses.bonus_chance) {
      finalCoins *= 2;
      orderCoinDoubled = true;
    }

    const { leveledUp } = manager.addXp(order.rewardXp);
    manager.addCoins(finalCoins);
    const afterOrder = manager.getState();

    const { reconstruction: rNext, completed: reconDone } = tickReconstructionAfterOrderComplete(
      afterOrder.reconstruction
    );
    let finalProg: ProgressionState = { ...afterOrder, reconstruction: rNext };
    let anyLevelUp = leveledUp;
    let reconCoins = 0;
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
      reconCoins = reconDone.rewardCoins;
    }

    const fieldOrder = handleOrderFieldProgress(
      gridAfterPickup,
      prev.fieldProgress,
      GRID_WIDTH,
      GRID_HEIGHT,
      orderBonuses.box_loot_chance
    );

    // Апгрейд «находки в ящиках».
    if (fieldOrder.bonusLootCoins > 0) {
      const mLoot = new ProgressionManager(finalProg);
      mLoot.addCoins(fieldOrder.bonusLootCoins);
      finalProg = mLoot.getState();
    }

    finalProg = { ...finalProg, totalOrdersCompleted: (prog.totalOrdersCompleted ?? 0) + 1 };
    finalProg = bumpMaxSeenItemLevelFromGrid(finalProg, fieldOrder.grid);

    // Заказ возвращает немного энергии — иначе поле упирается в реген и сессия обрывается.
    const energyAfter = anyLevelUp
      ? prev.maxEnergy
      : Math.min(prev.maxEnergy, prev.energy + ENERGY_ORDER_COMPLETE_BONUS);

    progStateRef.current = finalProg;
    setProgState(finalProg);
    setState({
      ...prev,
      grid: fieldOrder.grid,
      fieldProgress: fieldOrder.fieldProgress,
      orders: newOrders,
      energy: energyAfter,
    });

    if (fieldOrder.unlockedGeneratorItemId) {
      const gDef = ALL_ITEMS[fieldOrder.unlockedGeneratorItemId];
      const chId = gDef && itemIsGenerator(gDef) ? gDef.spawnsChainId : null;
      const chName = chId ? ITEM_CHAINS[chId]?.name : null;
      setRoomPurchaseToast(
        chName
          ? `🎉 Новый источник предметов! Открыт «${chName}». Предметы под паутиной обновились.`
          : "🎉 Новый источник предметов! Предметы под паутиной обновились."
      );
      window.setTimeout(() => setRoomPurchaseToast(null), 3600);
      if (fieldOrder.zoneJustCompleted) {
        const zoneName = fieldOrder.zoneJustCompleted.name;
        window.setTimeout(() => {
          setRoomPurchaseToast(`Зона «${zoneName}» полностью открыта!`);
          window.setTimeout(() => setRoomPurchaseToast(null), 3200);
        }, 3800);
      }
    } else if (fieldOrder.zoneJustCompleted) {
      setRoomPurchaseToast(`Зона «${fieldOrder.zoneJustCompleted.name}» полностью открыта!`);
      window.setTimeout(() => setRoomPurchaseToast(null), 3200);
    } else if (fieldOrder.bonusLootCoins > 0) {
      pushRoomToast(`В ящике нашлись ${fieldOrder.bonusLootCoins} монет!`, 2200);
    }

    if (fieldOrder.openedCellIndices.length > 0) {
      const heavy = Boolean(fieldOrder.unlockedGeneratorItemId);
      setCellUnlockHeavyFlash(heavy);
      setCellUnlockedFlashIndices(fieldOrder.openedCellIndices);
      window.setTimeout(
        () => {
          setCellUnlockedFlashIndices([]);
          setCellUnlockHeavyFlash(false);
        },
        heavy ? 920 : 450
      );
    }

    if (orderCoinDoubled) {
      setShowOrderCoinBonus(true);
      window.setTimeout(() => setShowOrderCoinBonus(false), 1500);
    }
    if (anyLevelUp) triggerLevelUp();
    setOrdersCompleted((c) => c + 1);
    updateQuestProgress("order", 1);
    updateQuestProgress("coins", finalCoins + reconCoins + fieldOrder.bonusLootCoins);
    playSfx("order_complete", 0.52);
    if (anchorRect) {
      setCoinFlyBurst({
        id: Date.now(),
        cx: anchorRect.left + anchorRect.width / 2,
        cy: anchorRect.top + anchorRect.height / 2,
        count: 7,
      });
    } else {
      setCoinFly({ source: "order", orderId: order.id, amount: finalCoins });
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
      const nextProg = newProg;
      const bonuses = new ProgressionManager(nextProg).getActiveBonuses();
      const refillGameOrders = Boolean(u && u.effectType === "visual" && currentScreenRef.current === "game");
      setProgState(nextProg);
      setState((s) => {
        if (!s) return s;
        let orders = s.orders;
        if (refillGameOrders) {
          const o = [...s.orders];
          const maxSeen = bumpMaxSeenItemLevelFromGrid(nextProg, s.grid).maxSeenItemLevel;
          const slots = activeOrderSlots(nextProg.level, maxSeen, s.grid, s.playZone);
          let guard = 0;
          while (o.length < slots && guard < 12) {
            guard += 1;
            o.push(generateNewOrder(nextProg.level, maxSeen, s.grid, s.playZone, o));
          }
          orders = o;
        }
        return { ...s, orders, maxEnergy: INITIAL_ENERGY + bonuses.energy_max };
      });
      updateQuestProgress("upgrade", 1);
      sounds.purchase();
      setPurchaseSparkleNonce((n) => n + 1);
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
    const lastRaw = localStorage.getItem(LAST_DAILY_BONUS_KEY);
    const last = lastRaw ? Number(lastRaw) : null;
    const now = Date.now();
    if (last && now - last <= DAILY_BONUS_COOLDOWN_MS) return;
    if (!progState || !state) return;

    const claimedDay = dailyStreakDayForNextClaim(last, now);

    const manager = new ProgressionManager(progState);
    manager.addCoins(coins);
    setProgState(manager.getState());
    setState((s) => (s ? { ...s, energy: Math.min(s.maxEnergy, s.energy + energy) } : s));
    try {
      localStorage.setItem(LAST_DAILY_BONUS_KEY, String(now));
      localStorage.setItem(DAILY_STREAK_KEY, String(claimedDay));
    } catch {
      /* ignore */
    }
    setDailyBonusDay(claimedDay);
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

  /** Из главного меню: экран «Дом» (хаб), состояние игры не трогаем. */
  const handleContinueFromMenu = useCallback(() => {
    setCurrentScreen("hub");
  }, []);

  const handleNewGame = useCallback(() => {
    // Спрашиваем только если есть что терять: на пустом старте кнопка называется «Начать игру».
    const hasProgress =
      saveLoadedFromDisk || ordersCompleted > 0 || (progState?.level ?? 1) > 1 || (progState?.coins ?? 0) > 0;
    if (hasProgress && !window.confirm("Ты уверен? Весь прогресс будет сброшен.")) return;
    setSaveLoadedFromDisk(false);
    resetGame();
    setCurrentScreen("hub");
  }, [devMode, saveLoadedFromDisk, ordersCompleted, progState?.level, progState?.coins]);

  /** С экрана «Дом» в миниигру; на первом запуске показываем короткий центральный туториал. */
  const handlePlayFromHub = useCallback(() => {
    setHubPulsePlayButton(false);
    setCurrentScreen("game");
    if (state?.isFirstLaunch) {
      setShowTutorial(true);
    }
    setState((s) => {
      if (!s) return s;
      let next = { ...s };
      if (state?.isFirstLaunch) {
        next = { ...next, isFirstLaunch: false };
      }
      return next;
    });
  }, [state?.isFirstLaunch]);

  /** Тик раз в секунду для пересчёта ms до следующей энергии на экране игры — должен быть до early return (Rules of Hooks). */
  const [gameEnergyMsTick, setGameEnergyMsTick] = useState(0);
  useEffect(() => {
    if (currentScreen !== "game") return;
    const id = window.setInterval(() => setGameEnergyMsTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [currentScreen]);

  const energyAdCooldownMs = useMemo(() => {
    void gameEnergyMsTick;
    if (lastEnergyAdAt <= 0) return 0;
    return Math.max(0, ENERGY_AD_COOLDOWN_MS - (Date.now() - lastEnergyAdAt));
  }, [lastEnergyAdAt, gameEnergyMsTick]);

  const msUntilNextEnergy = useMemo(() => {
    if (!state || state.energy >= state.maxEnergy) return 0;
    void gameEnergyMsTick;
    const elapsed = Date.now() - state.lastEnergyRegenAt;
    return Math.max(0, ENERGY_REGEN_INTERVAL_MS - elapsed);
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
            musicOn={musicOn}
            onMusicOnChange={(on) => {
              setMusicOn(on);
              setMusicEnabled(on);
              void playBackgroundMusicIfAllowed();
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
            hubOrdersToast={hubOrdersBackToast}
            pulsePlayButton={hubPulsePlayButton}
            onNavigateRoom={(zone) => {
              setRoomPurchaseToast(null);
              if (purchaseToastClearRef.current) {
                window.clearTimeout(purchaseToastClearRef.current);
                purchaseToastClearRef.current = null;
              }
              setActiveZone(zone);
              setCurrentScreen("room");
            }}
            dailyUnclaimedCount={questBanner.unclaimedCount}
            onOpenDaily={() => setCurrentScreen("daily")}
            onOpenCoinShop={() => setCoinShopOpen(true)}
            onOpenCollection={() => setCurrentScreen("collection")}
            onBackToMenu={handleBackToMainMenu}
            onPlay={handlePlayFromHub}
            reconstruction={progState.reconstruction}
            canDeliverReconstructionItem={canDeliverReconstructionItem(progState.reconstruction, state.grid)}
            onDeliverReconstructionItem={handleReconstructionDeliver}
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
            onWatchAdCoins={handleWatchAdCoins}
            adCoinsReward={COINS_AD_REWARD}
            adCoinsCooldownMs={coinsAdCooldownMs}
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
          generatorAppearIndices={generatorAppearIndices}
          generatorUnlockFx={generatorUnlockFx}
          onDismissGeneratorUnlockFx={() => setGeneratorUnlockFx(null)}
          cellUnlockHeavyFlash={cellUnlockHeavyFlash}
          cellShakePair={cellShakePair}
          coinFly={coinFly}
          mergeBurstCellIndex={mergeBurstCellIndex}
          freeSpawnFlashIndex={freeSpawnFlashIndex}
          gridWidth={GRID_WIDTH}
          gridHeight={GRID_HEIGHT}
          isNoMoves={isNoMoves}
          onNoMovesExitHome={handleNoMovesExitHome}
          onWatchAdEnergy={handleWatchAdEnergy}
          energyAdCooldownMs={energyAdCooldownMs}
          lenaHint={lenaHint}
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

      {/*
        Туториал только в игре, не над главным меню.
        Без AnimatePresence намеренно: exit-анимация не завершалась, узел оставался в DOM
        с opacity: 0 и pointer-events: auto и полностью блокировал нажатия по полю.
      */}
      {currentScreen === "game" && showTutorial ? (
        <div className="modal-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(92,61,34,0.45)] p-4">
          <div className="modal-pop-in ds-card w-full max-w-xs p-6 text-center">
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
                    Нажми на <b>генератор</b> (в зале это 🛎️) — рядом появится предмет 1 уровня. Каждая выдача
                    тратит <b>1 энергии</b>.
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
                    Соединяй <b>одинаковые</b> предметы — перетащи один на другой или нажми на оба по очереди.
                    Получится предмет следующего уровня.
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
                    Собери всё для <b>заказа</b> сверху и жми «Отдать» — это монеты, опыт и новые клетки поля.
                  </p>
                </div>
              </div>
            <button type="button" onClick={() => setShowTutorial(false)} className="ds-btn-primary w-full">
              Понятно
            </button>
          </div>
        </div>
      ) : null}

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
            key="levelup-overlay"
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.25 }}
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
