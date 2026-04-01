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

export type CellState = "normal" | "dirty_1" | "dirty_2" | "locked";

/** Временно: любая не-normal клетка ведёт себя как препятствие (грязь, замок). */
export function isObstacleCellState(cellState: CellState): boolean {
  return cellState !== "normal";
}

/** id предмета-ключа и цепочки (не участвуют в заказах и луте с грязи). */
export const KEY_ITEM_ID = "key";
export const KEY_CHAIN_ID = "key_chain";

export interface GridCell {
  item: Item | null;
  cellState: CellState;
  /** Оставшиеся выдачи для генератора (`item` с `isGenerator`); для прочих клеток не используется. */
  generatorCharges?: number;
}

/** Стартовое число зарядов при появлении генератора на поле. */
export const INITIAL_GENERATOR_CHARGES = 5;

/**
 * Сколько выдач осталось у генератора в этой клетке (0 — не активен).
 * `maxCharges` — фактический максимум с учётом апгрейдов (см. getGeneratorMaxCharges).
 */
export function cellGeneratorChargesRemaining(cell: GridCell, maxCharges: number): number {
  if (!cell.item) return 0;
  const d = ALL_ITEMS[cell.item];
  if (!d || !itemIsGenerator(d)) return 0;
  const cap = Math.max(INITIAL_GENERATOR_CHARGES, maxCharges);
  const c = cell.generatorCharges;
  if (typeof c === "number") return Math.max(0, Math.min(c, cap));
  return cap;
}

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

export interface ItemChain {
  id: string;
  name: string;
  items: ItemDefinition[];
}

export interface OrderRequirement {
  itemId: ItemId;
  count: number;
}

export interface Order {
  id: string;
  requirements: OrderRequirement[];
  /** Сдано по одному предмету; ключи — itemId из requirements. */
  delivered: Partial<Record<ItemId, number>>;
  rewardCoins: number;
  rewardXp: number;
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

/** Есть ли на поле предмет, который ещё можно сдать по этому заказу. */
export function orderCanDeliverFromGrid(grid: GridCell[], order: Order): boolean {
  for (const r of order.requirements) {
    if (orderRemainingForItem(order, r.itemId) > 0 && grid.some((c) => c.item === r.itemId)) return true;
  }
  return false;
}

/** Первая клетка с предметом, подходящим для текущего прогресса заказа. */
export function findFirstCellIndexForOrderDelivery(grid: GridCell[], order: Order): number {
  for (let i = 0; i < grid.length; i++) {
    const id = grid[i].item;
    if (id != null && orderRemainingForItem(order, id) > 0) return i;
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
}

/** Игровая сцена (поле, энергия, заказы). coins / level / xp — только в ProgressionState. */
export interface GameState {
  grid: GridCell[];
  energy: number;
  maxEnergy: number;
  orders: Order[];
  isFirstLaunch: boolean;
}

const FRUIT_CHAIN_LEN = 7;
const SWEETS_CHAIN_LEN = 7;

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
  [KEY_CHAIN_ID]: {
    id: KEY_CHAIN_ID,
    name: "Ключи",
    items: [
      {
        id: KEY_ITEM_ID,
        name: "Ключ",
        emoji: "🔑",
        level: 1,
        chain: KEY_CHAIN_ID,
        xpReward: 0,
        coinReward: 0,
        rarity: rarityForMergeableLevel(1, 1),
        description: "Этот ключ явно от чего-то важного.",
      },
    ],
  },
};

/** Цепочки для заказов и случайного лута (без ключей). */
export function chainsEligibleForLootAndOrders(): ItemChain[] {
  return Object.values(ITEM_CHAINS).filter((c) => c.id !== KEY_CHAIN_ID);
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

/** Пример генератора: корзина даёт 1-й уровень фруктовой цепочки. */
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
};
