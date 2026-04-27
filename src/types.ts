import {
  ROOM_GENERATOR_DEFS,
  ROOM_MERGE_CHAINS,
  ZONE_TO_GENERATOR_ID,
  ZONE_TO_MERGE_CHAIN_ID,
} from "./roomMergeCatalog";

export type ItemId = string;

export type ItemRarity = "common" | "rare" | "epic";

/** Редкость ступени цепочки: низ / середина / верх. Для одной ступени (ключ) — epic. */
export function rarityForMergeableLevel(level: number, chainItemCount: number): ItemRarity {
  if (chainItemCount <= 1) return "epic";
  if (level <= 2) return "common";
  if (level <= 5) return "rare";
  return "epic";
}

/** Ссылка на предмет в ячейке сетки (совпадает с id из ALL_ITEMS). */
export type Item = ItemId;

/**
 * Тип клетки поля (Merge Hotel Empire).
 * - box — закрытый ящик; hint_box — ящик-намёк на границе зоны; cobweb — предмет под паутиной.
 */
export type CellType = "empty" | "item" | "generator" | "box" | "hint_box" | "cobweb";

/** Открытые клетки: ходы, генератор, выдача заказов только с `item`. */
export function isOpenCellType(t: CellType): boolean {
  return t === "empty" || t === "item" || t === "generator";
}

/** Закрытый ящик или ящик-намёк (открываются зональной прогрессией). */
export function isSealedFieldCellType(t: CellType): boolean {
  return t === "box" || t === "hint_box";
}

/** Нельзя положить предмет / обменять (ящик). Паутина обрабатывается отдельно при слиянии. */
export function isBlockedCellType(t: CellType): boolean {
  return t === "box" || t === "hint_box";
}

/** @deprecated Используйте isBlockedCellType(cell.cellType) или !isOpenCellType. */
export function isObstacleCellState(cellType: CellType): boolean {
  return isBlockedCellType(cellType);
}

export interface GridCell {
  cellType: CellType;
  item: Item | null;
  /** Уровень предмета (для cobweb — видимый уровень под паутиной; для empty/box — 0). */
  itemLevel: number;
  /** Цепочка слияния (`ITEM_CHAINS`), для генератора — `spawnsChainId`. */
  chainId: string | null;
  /** Содержимое закрытого ящика (скрыто до открытия). Для `box` и `hint_box`. */
  boxItem: Item | null;
  boxItemLevel: number;
  boxChainId: string | null;
  /** Ящик при открытии превращается в генератор (`boxGeneratorId`), а не в cobweb. */
  boxIsGenerator: boolean;
  /** Id предмета-генератора из `ALL_ITEMS` (как у стартовой клетки). */
  boxGeneratorId: string | null;
}

export function isSealedFieldCell(cell: GridCell): boolean {
  return isSealedFieldCellType(cell.cellType);
}

export function isCobwebUnknownPlaceholder(cell: GridCell): boolean {
  return cell.cellType === "cobweb" && cell.item === COBWEB_UNKNOWN_ITEM_ID;
}

/** Одновременно активных заказов на экране миниигры. */
export const MAX_ACTIVE_ORDERS = 3;

/** Навигация без роутера */
/** `menu` — только кнопки; `hub` — уровень, реконструкция, задания, комнаты. */
export type AppScreen = "menu" | "hub" | "room" | "game" | "daily" | "collection";

export type ActiveZone =
  | "hall"
  | "kitchen"
  | "terrace"
  | "secret"
  | "bedroom"
  | "bathroom"
  | "office"
  | "lounge"
  | "garden";

export const ALL_ACTIVE_ZONES: ActiveZone[] = [
  "hall",
  "kitchen",
  "bedroom",
  "bathroom",
  "terrace",
  "office",
  "lounge",
  "secret",
  "garden",
];

/** Отображаемые названия комнат на экране миниигры и в UI */
export const ZONE_NAMES: Record<ActiveZone, string> = {
  hall: "Основной зал",
  kitchen: "Кухня",
  bedroom: "Спальня",
  bathroom: "Ванная",
  terrace: "Терраса",
  secret: "Тайная комната",
  office: "Кабинет",
  lounge: "Бар / лаунж",
  garden: "Сад",
};

export function isActiveZone(x: unknown): x is ActiveZone {
  return typeof x === "string" && (ALL_ACTIVE_ZONES as string[]).includes(x);
}

/** Id зоны в `Upgrade.zone` и в `ProgressionState.unlockedZones` (кроме `meta`). */
export type ProgressZoneId =
  | "hall"
  | "kitchen"
  | "terrace"
  | "secret_room"
  | "bedroom"
  | "bathroom"
  | "office"
  | "lounge"
  | "garden";

/** Соответствие экрана комнаты и поля Upgrade.zone / unlockedZones */
export function progressZoneId(z: ActiveZone): ProgressZoneId {
  return z === "secret" ? "secret_room" : z;
}

/** Обычный предмет цепочки слияний. */
export interface MergeableItemDefinition {
  id: ItemId;
  name: string;
  emoji: string;
  level: number;
  chain: string;
  xpReward: number;
  coinReward: number;
  rarity: ItemRarity;
  /** Короткая реплика при первом открытии в коллекции. */
  description?: string;
  isGenerator?: false;
}

/** Генератор: по клику создаёт предмет 1 уровня выбранной цепочки; не сливается. */
export interface GeneratorItemDefinition {
  id: ItemId;
  name: string;
  emoji: string;
  chain: string;
  xpReward: number;
  coinReward: number;
  rarity: ItemRarity;
  isGenerator: true;
  /** id цепочки из ITEM_CHAINS — спавнится items[0]. */
  spawnsChainId: string;
}

/** Ресурс на поле: один клик — начисление и исчезновение. */
export interface ResourcePickupItemDefinition {
  id: ItemId;
  name: string;
  emoji: string;
  chain: string;
  xpReward: number;
  coinReward: number;
  rarity: ItemRarity;
  isResourcePickup: true;
  grantsCoins: number;
  grantsEnergy: number;
}

export type ItemDefinition = MergeableItemDefinition | GeneratorItemDefinition | ResourcePickupItemDefinition;

export function itemIsGenerator(def: ItemDefinition): def is GeneratorItemDefinition {
  return def.isGenerator === true;
}

export function itemIsResourcePickup(def: ItemDefinition): def is ResourcePickupItemDefinition {
  return "isResourcePickup" in def && def.isResourcePickup === true;
}

/** Подбираемые награды на клетке. */
export const COIN_PICKUP_ITEM_ID = "coin_item";
export const ENERGY_PICKUP_ITEM_ID = "energy_item";

/** Доля лута с грязи (после прохода общего шанса дропа), приходящаяся на монеты/энергию. */
export const DIRTY_LOOT_RESOURCE_CHANCE = 0.28;

/** Шанс генератора выдать ресурс вместо предмета 1 уровня. */
export const GENERATOR_RESOURCE_DROP_CHANCE = 0.12;

/** Паутина-заглушка: цепочка ещё без генератора; `boxChainId` / `boxItemLevel` — заложенный лут. */
export const COBWEB_UNKNOWN_ITEM_ID = "cobweb_unknown";

export interface ItemChain {
  id: string;
  name: string;
  items: ItemDefinition[];
}

export interface OrderRequirement {
  itemId: ItemId;
  count: number;
  /** Опционально: минимальный уровень (для id с уровнем в цепочке совпадает с ALL_ITEMS). */
  itemLevel?: number;
}

/** Пул эмодзи заказчиков — задаётся при создании заказа (`Order.customerEmoji`). */
export const ORDER_CUSTOMER_EMOJIS = [
  "👨",
  "👩‍🍳",
  "👮",
  "🧑‍💼",
  "👩‍🔬",
  "🧑‍🎨",
  "👨‍⚕️",
  "🧑‍🏫",
  "🧑‍⚕️",
  "🧑‍🎓",
  "🧑‍🌾",
  "🧑‍🔧",
  "🧑‍✈️",
  "🧑‍🚒",
] as const;

/** Детерминированный заказчик по id заказа (для сохранений без поля customerEmoji). */
export function customerEmojiForOrderId(orderId: string): string {
  let h = 0;
  for (let i = 0; i < orderId.length; i++) {
    h = (Math.imul(31, h) + orderId.charCodeAt(i)) | 0;
  }
  const u = h >>> 0;
  return ORDER_CUSTOMER_EMOJIS[u % ORDER_CUSTOMER_EMOJIS.length]!;
}

export interface Order {
  id: string;
  /** Стабильный id экземпляра заказа в сессии (для React key и сдачи по нужной карточке). */
  instanceId: string;
  requirements: OrderRequirement[];
  /** Сдано по одному предмету; ключи — itemId из requirements. */
  delivered: Partial<Record<ItemId, number>>;
  rewardCoins: number;
  rewardXp: number;
  /** Эмодзи заказчика на карточке заказа. */
  customerEmoji?: string;
}

export function orderRemainingForItem(order: Order, itemId: ItemId): number {
  const req = order.requirements.find((r) => r.itemId === itemId);
  if (!req) return 0;
  const done = order.delivered[itemId] ?? 0;
  return Math.max(0, req.count - done);
}

export function orderIsFulfilled(order: Order): boolean {
  return order.requirements.every((r) => orderRemainingForItem(order, r.itemId) === 0);
}

/** Сколько открытых клеток `item` с данным id на поле. */
export function countOpenItemCellsForId(grid: GridCell[], itemId: ItemId): number {
  let n = 0;
  for (const c of grid) {
    if (c.cellType === "item" && c.item === itemId) n += 1;
  }
  return n;
}

/** Суммарный остаток по id по всем активным заказам. */
export function unmetOrderDemandForItemId(orders: Order[], itemId: ItemId): number {
  return orders.reduce((sum, o) => sum + orderRemainingForItem(o, itemId), 0);
}

/** Зелёная галочка на клетке: по всем заказам хватает открытых предметов этого id. */
export function itemCellShowsOrderReadyCheck(orders: Order[], grid: GridCell[], cellItemId: ItemId): boolean {
  const demand = unmetOrderDemandForItemId(orders, cellItemId);
  if (demand <= 0) return false;
  return countOpenItemCellsForId(grid, cellItemId) >= demand;
}

/** Слот заказа «на поле есть нужное количество» (или строка уже закрыта). */
export function orderReqLineSatisfiedOnGrid(grid: GridCell[], order: Order, req: OrderRequirement): boolean {
  const rem = orderRemainingForItem(order, req.itemId);
  if (rem <= 0) return true;
  return countOpenItemCellsForId(grid, req.itemId) >= rem;
}

/** Все незакрытые строки заказа можно снять с поля одним действием (только `item`, не cobweb). */
export function orderAllRemainingSatisfiedFromGrid(grid: GridCell[], order: Order): boolean {
  const seen = new Set<ItemId>();
  for (const r of order.requirements) {
    if (seen.has(r.itemId)) continue;
    seen.add(r.itemId);
    const rem = orderRemainingForItem(order, r.itemId);
    if (rem <= 0) continue;
    if (countOpenItemCellsForId(grid, r.itemId) < rem) return false;
  }
  return true;
}

/** Индексы клеток для полной сдачи заказа (порядок обхода слева направо). */
export function collectIndicesForFullOrderDelivery(grid: GridCell[], order: Order): number[] {
  const indices: number[] = [];
  const used = new Set<number>();
  const seen = new Set<ItemId>();
  for (const r of order.requirements) {
    if (seen.has(r.itemId)) continue;
    seen.add(r.itemId);
    let need = orderRemainingForItem(order, r.itemId);
    for (let i = 0; i < grid.length && need > 0; i++) {
      if (used.has(i)) continue;
      if (grid[i].cellType === "item" && grid[i].item === r.itemId) {
        indices.push(i);
        used.add(i);
        need -= 1;
      }
    }
    if (need > 0) return [];
  }
  return indices;
}

/** Заказ можно выполнить одним нажатием «Отдать»: все незакрытые позиции закрыты открытыми `item` на поле. */
export function orderCanDeliverFromGrid(grid: GridCell[], order: Order): boolean {
  return orderAllRemainingSatisfiedFromGrid(grid, order);
}

/** Первая клетка с предметом для сдачи заказа (только `item`). */
export function findFirstCellIndexForOrderDelivery(grid: GridCell[], order: Order): number {
  for (let i = 0; i < grid.length; i++) {
    const id = grid[i].item;
    if (id != null && grid[i].cellType === "item" && orderRemainingForItem(order, id) > 0) return i;
  }
  return -1;
}

/** Короткая анимация «+N 🍪» у заказа или у клетки слияния (награда за очистку). */
export type CoinFlyState =
  | { source: "order"; orderId: string; amount: number }
  | { source: "clean"; cellIndex: number; amount: number };

export type UpgradeZoneId = ProgressZoneId | "meta";

export interface Upgrade {
  id: string;
  name: string;
  zone: UpgradeZoneId;
  cost: number;
  requiredLevel: number;
  effectType:
    | "visual"
    | "energy_max"
    | "gen_speed"
    | "income_bonus"
    | "bonus_chance"
    | "gen_extra_charges"
    | "dirty_drop_chance"
    | "free_spawn_chance";
  effectValue: number;
  description: string;
}

export interface LevelConfig {
  level: number;
  xpRequired: number;
  unlocks: string[];
  newFeatures: string[];
  availableUpgrades: string[];
}

/** Прогресс цепочки «Реконструкция кафе» (см. `reconstruction.ts`). */
export interface ReconstructionState {
  stageIndex: number;
  ordersForStage: number;
  itemsDelivered: Partial<Record<ItemId, number>>;
}

export interface ProgressionState {
  level: number;
  xp: number;
  coins: number;
  unlockedZones: string[];
  purchasedUpgrades: string[];
  reconstruction: ReconstructionState;
  /** Коллекция: предметы из ITEM_CHAINS, впервые появившиеся у игрока. */
  collectedItems: Partial<Record<ItemId, boolean>>;
  /** Полнота цепочки уже награждена (монеты в progression, энергия начислялась в момент выдачи). */
  collectionChainRewardsClaimed: Partial<Record<string, boolean>>;
  /** Всего выполненных заказов миниигры (награды каждые 5 / 20; не сбрасывается). */
  totalOrdersCompleted: number;
  /** Макс. уровень mergeable-предмета, который игрок уже «видел» на поле (для недостижимых заказов). */
  maxSeenItemLevel: number;
  /** Выполнено заказов миниигры на текущем уровне ремонта комнаты (сброс при новом визуальном апгрейде этой зоны). */
  minigameOrdersAtRoomRepair: Partial<Record<ActiveZone, number>>;
}

/** Прогресс зонального открытия поля (очереди, слияния для зоны 1, заказы для зон 2–3). */
export interface FieldProgressState {
  unlockQueues: {
    zone_1: number[];
    zone_2: number[];
    zone_3: number[];
  };
  zone1MergeProgress: number;
  /** Выполненных заказов миниигры (счётчик для открытия зон 2 и 3). */
  ordersForFieldProgress: number;
}

/** Игровая сцена (поле, энергия, заказы). coins / level / xp — только в ProgressionState. */
export interface GameState {
  grid: GridCell[];
  energy: number;
  maxEnergy: number;
  /** Время последнего +1 энергии по таймеру (для отображения «до следующей»). */
  lastEnergyRegenAt: number;
  orders: Order[];
  isFirstLaunch: boolean;
  /** Комната, с которой открыта текущая сессия поля (генератор и лут с грязи). */
  playZone: ActiveZone;
  /** Очереди открытия ящиков по зонам и накопленные слияния для темпа. */
  fieldProgress: FieldProgressState;
}

const FRUIT_CHAIN_LEN = 7;
const SWEETS_CHAIN_LEN = 7;

const ROOM_ITEM_CHAINS_MAP: Record<string, ItemChain> = Object.fromEntries(
  Object.values(ROOM_MERGE_CHAINS).map((c) => [
    c.id,
    {
      id: c.id,
      name: c.name,
      items: c.items as MergeableItemDefinition[],
    },
  ])
);

export const ITEM_CHAINS: Record<string, ItemChain> = {
  fruit: {
    id: "fruit",
    name: "Фруктовый сад",
    items: [
      {
        id: "f1",
        name: "Красное яблоко",
        emoji: "🍎",
        level: 1,
        chain: "fruit",
        xpReward: 1,
        coinReward: 2,
        rarity: rarityForMergeableLevel(1, FRUIT_CHAIN_LEN),
        description: "Свежее яблоко — начало простой истории.",
      },
      {
        id: "f2",
        name: "Зеленое яблоко",
        emoji: "🍏",
        level: 2,
        chain: "fruit",
        xpReward: 2,
        coinReward: 4,
        rarity: rarityForMergeableLevel(2, FRUIT_CHAIN_LEN),
        description: "Чуть кислее — как будто сад знает толк в контрасте.",
      },
      {
        id: "f3",
        name: "Груша",
        emoji: "🍐",
        level: 3,
        chain: "fruit",
        xpReward: 4,
        coinReward: 8,
        rarity: rarityForMergeableLevel(3, FRUIT_CHAIN_LEN),
      },
      {
        id: "f4",
        name: "Апельсин",
        emoji: "🍊",
        level: 4,
        chain: "fruit",
        xpReward: 8,
        coinReward: 16,
        rarity: rarityForMergeableLevel(4, FRUIT_CHAIN_LEN),
        description: "Запах цитруса — будто лето ещё рядом.",
      },
      {
        id: "f5",
        name: "Лимон",
        emoji: "🍋",
        level: 5,
        chain: "fruit",
        xpReward: 16,
        coinReward: 32,
        rarity: rarityForMergeableLevel(5, FRUIT_CHAIN_LEN),
      },
      {
        id: "f6",
        name: "Банан",
        emoji: "🍌",
        level: 6,
        chain: "fruit",
        xpReward: 32,
        coinReward: 64,
        rarity: rarityForMergeableLevel(6, FRUIT_CHAIN_LEN),
        description: "Похоже, здесь что-то скрывают за этим изгибом кривой.",
      },
      {
        id: "f7",
        name: "Арбуз",
        emoji: "🍉",
        level: 7,
        chain: "fruit",
        xpReward: 64,
        coinReward: 128,
        rarity: rarityForMergeableLevel(7, FRUIT_CHAIN_LEN),
        description: "Корона урожая — и, кажется, не только про фрукты.",
      },
    ],
  },
  sweets: {
    id: "sweets",
    name: "Пекарня",
    items: [
      {
        id: "s1",
        name: "Капкейк",
        emoji: "🧁",
        level: 1,
        chain: "sweets",
        xpReward: 1,
        coinReward: 2,
        rarity: rarityForMergeableLevel(1, SWEETS_CHAIN_LEN),
        description: "Маленький капкейк — кто-то уже отошёл от стола.",
      },
      {
        id: "s2",
        name: "Кусочек торта",
        emoji: "🍰",
        level: 2,
        chain: "sweets",
        xpReward: 2,
        coinReward: 4,
        rarity: rarityForMergeableLevel(2, SWEETS_CHAIN_LEN),
      },
      {
        id: "s3",
        name: "Именинный торт",
        emoji: "🎂",
        level: 3,
        chain: "sweets",
        xpReward: 4,
        coinReward: 8,
        rarity: rarityForMergeableLevel(3, SWEETS_CHAIN_LEN),
        description: "Этот торт кто-то не доел… или не успел.",
      },
      {
        id: "s4",
        name: "Пудинг",
        emoji: "🍮",
        level: 4,
        chain: "sweets",
        xpReward: 8,
        coinReward: 16,
        rarity: rarityForMergeableLevel(4, SWEETS_CHAIN_LEN),
      },
      {
        id: "s5",
        name: "Пончик",
        emoji: "🍩",
        level: 5,
        chain: "sweets",
        xpReward: 16,
        coinReward: 32,
        rarity: rarityForMergeableLevel(5, SWEETS_CHAIN_LEN),
      },
      {
        id: "s6",
        name: "Печенье",
        emoji: "🍪",
        level: 6,
        chain: "sweets",
        xpReward: 32,
        coinReward: 64,
        rarity: rarityForMergeableLevel(6, SWEETS_CHAIN_LEN),
        description: "Печенье из той же банки, что стояла у бабушки за стойкой.",
      },
      {
        id: "s7",
        name: "Шоколад",
        emoji: "🍫",
        level: 7,
        chain: "sweets",
        xpReward: 64,
        coinReward: 128,
        rarity: rarityForMergeableLevel(7, SWEETS_CHAIN_LEN),
        description: "Плитка награды — сладкая, но не простая.",
      },
    ],
  },
  ...ROOM_ITEM_CHAINS_MAP,
};

const GENERATOR_ID_TO_PLAY_ZONE: Record<string, ActiveZone> = (() => {
  const m: Record<string, ActiveZone> = {
    basket_generator: "hall",
  };
  (Object.keys(ZONE_TO_GENERATOR_ID) as ActiveZone[]).forEach((z) => {
    m[ZONE_TO_GENERATOR_ID[z]] = z;
  });
  return m;
})();

export function mergeChainIdForZone(z: ActiveZone): string {
  return ZONE_TO_MERGE_CHAIN_ID[z];
}

export function generatorItemIdForZone(z: ActiveZone): string {
  return ZONE_TO_GENERATOR_ID[z];
}

export function activeZoneFromGeneratorItemId(itemId: string): ActiveZone | null {
  const z = GENERATOR_ID_TO_PLAY_ZONE[itemId];
  return z ?? null;
}

/** Лут с грязи: цепочка текущей комнаты + фрукты и сладости (не раздувает пул). */
export function chainsForSessionDirtyLoot(zone: ActiveZone): ItemChain[] {
  const primary = ITEM_CHAINS[mergeChainIdForZone(zone)];
  const list = [primary, ITEM_CHAINS.fruit, ITEM_CHAINS.sweets];
  return list.filter((c): c is ItemChain => Boolean(c));
}

/** Цепочки для заказов и случайного лута (только mergeable-предметы, без генераторов). */
export function chainsEligibleForLootAndOrders(): ItemChain[] {
  return Object.values(ITEM_CHAINS).filter((c) =>
    c.items.some((it) => "level" in it && !itemIsGenerator(it) && !itemIsResourcePickup(it))
  );
}

const ALL_ITEMS_FROM_CHAINS: Record<ItemId, ItemDefinition> = Object.values(ITEM_CHAINS).reduce(
  (acc, chain) => {
    chain.items.forEach((item) => {
      acc[item.id] = item;
    });
    return acc;
  },
  {} as Record<ItemId, ItemDefinition>
);

const ROOM_ZONE_GENERATORS: Record<ItemId, GeneratorItemDefinition> = Object.fromEntries(
  Object.values(ROOM_GENERATOR_DEFS).map((g) => [
    g.id,
    {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      chain: "generator",
      isGenerator: true as const,
      spawnsChainId: g.spawnsChainId,
      xpReward: 0,
      coinReward: 0,
      rarity: "common" as const,
    },
  ])
);

/** Корзина (наследие сохранений) и генераторы по комнатам. */
const GENERATOR_ITEMS: Record<ItemId, ItemDefinition> = {
  basket_generator: {
    id: "basket_generator",
    name: "Корзина урожая",
    emoji: "🧺",
    chain: "generator",
    isGenerator: true,
    spawnsChainId: "fruit",
    xpReward: 0,
    coinReward: 0,
    rarity: "common",
  },
  ...ROOM_ZONE_GENERATORS,
};

const META_GRID_ITEMS: Record<ItemId, MergeableItemDefinition> = {
  [COBWEB_UNKNOWN_ITEM_ID]: {
    id: COBWEB_UNKNOWN_ITEM_ID,
    name: "Скрытый предмет",
    emoji: "❓",
    level: 1,
    chain: "meta_cobweb",
    xpReward: 0,
    coinReward: 0,
    rarity: "common",
  },
};

const RESOURCE_PICKUP_ITEMS: Record<ItemId, ItemDefinition> = {
  [COIN_PICKUP_ITEM_ID]: {
    id: COIN_PICKUP_ITEM_ID,
    name: "Монеты",
    emoji: "🪙",
    chain: "resource",
    isResourcePickup: true,
    grantsCoins: 12,
    grantsEnergy: 0,
    xpReward: 0,
    coinReward: 0,
    rarity: "common",
  },
  [ENERGY_PICKUP_ITEM_ID]: {
    id: ENERGY_PICKUP_ITEM_ID,
    name: "Энергия",
    emoji: "⚡",
    chain: "resource",
    isResourcePickup: true,
    grantsCoins: 0,
    grantsEnergy: 8,
    xpReward: 0,
    coinReward: 0,
    rarity: "common",
  },
};

export const ALL_ITEMS: Record<ItemId, ItemDefinition> = {
  ...ALL_ITEMS_FROM_CHAINS,
  ...GENERATOR_ITEMS,
  ...RESOURCE_PICKUP_ITEMS,
  ...META_GRID_ITEMS,
};

/** Цепочки слияний по генераторам на сетке (`spawnsChainId`). */
export function chainsFromGridGenerators(grid: GridCell[]): ItemChain[] {
  const seen = new Set<string>();
  const out: ItemChain[] = [];
  for (const c of grid) {
    if (c.cellType !== "generator" || !c.item) continue;
    const d = ALL_ITEMS[c.item];
    if (!d || !itemIsGenerator(d)) continue;
    const chId = d.spawnsChainId;
    if (!chId) continue;
    const chain = ITEM_CHAINS[chId];
    if (!chain) continue;
    if (!seen.has(chain.id)) {
      seen.add(chain.id);
      out.push(chain);
    }
  }
  return out;
}

/** Id цепочек (`spawnsChainId`), для которых на поле уже стоит генератор. */
export function activeSpawnsChainIdsFromGrid(grid: GridCell[]): Set<string> {
  const s = new Set<string>();
  for (const c of grid) {
    if (c.cellType !== "generator" || !c.item) continue;
    const d = ALL_ITEMS[c.item];
    if (d && itemIsGenerator(d) && d.spawnsChainId) s.add(d.spawnsChainId);
  }
  return s;
}

/** Заказы миниигры: только цепочки с текущих генераторов; иначе — цепочка комнаты. */
export function chainsForSessionOrders(grid: GridCell[], zone: ActiveZone): ItemChain[] {
  const fromGrid = chainsFromGridGenerators(grid);
  if (fromGrid.length > 0) return fromGrid;
  const ch = ITEM_CHAINS[mergeChainIdForZone(zone)];
  return ch ? [ch] : [ITEM_CHAINS.fruit];
}
