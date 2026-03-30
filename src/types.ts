export type ItemId = string;

export interface ItemDefinition {
  id: ItemId;
  name: string;
  emoji: string;
  level: number;
  chain: string;
  xpReward: number;
  coinReward: number;
}

export interface ItemChain {
  id: string;
  name: string;
  items: ItemDefinition[];
}

export interface Order {
  id: string;
  requiredItemId: ItemId;
  rewardCoins: number;
  rewardXp: number;
}

export interface Upgrade {
  id: string;
  name: string;
  zone: "hall" | "kitchen" | "terrace" | "secret_room";
  cost: number;
  requiredLevel: number;
  effectType: "energy_max" | "gen_speed" | "income_bonus" | "bonus_chance";
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

export interface ProgressionState {
  level: number;
  xp: number;
  coins: number;
  unlockedZones: string[];
  purchasedUpgrades: string[];
}

export interface GameState {
  grid: (ItemId | null)[];
  energy: number;
  maxEnergy: number;
  coins: number;
  xp: number;
  level: number;
  orders: Order[];
  isFirstLaunch: boolean;
}

export const ITEM_CHAINS: Record<string, ItemChain> = {
  fruit: {
    id: "fruit",
    name: "Фруктовый сад",
    items: [
      { id: "f1", name: "Красное яблоко", emoji: "🍎", level: 1, chain: "fruit", xpReward: 1, coinReward: 2 },
      { id: "f2", name: "Зеленое яблоко", emoji: "🍏", level: 2, chain: "fruit", xpReward: 2, coinReward: 4 },
      { id: "f3", name: "Груша", emoji: "🍐", level: 3, chain: "fruit", xpReward: 4, coinReward: 8 },
      { id: "f4", name: "Апельсин", emoji: "🍊", level: 4, chain: "fruit", xpReward: 8, coinReward: 16 },
      { id: "f5", name: "Лимон", emoji: "🍋", level: 5, chain: "fruit", xpReward: 16, coinReward: 32 },
      { id: "f6", name: "Банан", emoji: "🍌", level: 6, chain: "fruit", xpReward: 32, coinReward: 64 },
      { id: "f7", name: "Арбуз", emoji: "🍉", level: 7, chain: "fruit", xpReward: 64, coinReward: 128 },
    ],
  },
  sweets: {
    id: "sweets",
    name: "Пекарня",
    items: [
      { id: "s1", name: "Капкейк", emoji: "🧁", level: 1, chain: "sweets", xpReward: 1, coinReward: 2 },
      { id: "s2", name: "Кусочек торта", emoji: "🍰", level: 2, chain: "sweets", xpReward: 2, coinReward: 4 },
      { id: "s3", name: "Именинный торт", emoji: "🎂", level: 3, chain: "sweets", xpReward: 4, coinReward: 8 },
      { id: "s4", name: "Пудинг", emoji: "🍮", level: 4, chain: "sweets", xpReward: 8, coinReward: 16 },
      { id: "s5", name: "Пончик", emoji: "🍩", level: 5, chain: "sweets", xpReward: 16, coinReward: 32 },
      { id: "s6", name: "Печенье", emoji: "🍪", level: 6, chain: "sweets", xpReward: 32, coinReward: 64 },
      { id: "s7", name: "Шоколад", emoji: "🍫", level: 7, chain: "sweets", xpReward: 64, coinReward: 128 },
    ],
  },
};

export const ALL_ITEMS: Record<ItemId, ItemDefinition> = Object.values(ITEM_CHAINS).reduce(
  (acc, chain) => {
    chain.items.forEach((item) => {
      acc[item.id] = item;
    });
    return acc;
  },
  {} as Record<ItemId, ItemDefinition>
);
