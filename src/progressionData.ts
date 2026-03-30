import { LevelConfig, Upgrade } from "./types";

// Генерация 30 уровней по формуле: XP = 100 + (level * 20)
export const LEVELS: LevelConfig[] = Array.from({ length: 30 }, (_, i) => {
  const level = i + 1;
  const xpRequired = 100 + level * 20;
  
  let unlocks: string[] = [];
  let newFeatures: string[] = [];
  let availableUpgrades: string[] = [];

  // Уровни 1-4: Обучение
  if (level === 1) {
    unlocks = ["hall"];
    newFeatures = ["basic_orders"];
    availableUpgrades = ["chair_fix"];
  } else if (level === 2) {
    availableUpgrades = ["table_fix"];
  }

  // Уровень 5: Кухня
  if (level === 5) {
    unlocks = ["kitchen"];
    newFeatures = ["gen_speed_boost"];
    availableUpgrades = ["kitchen_stove"];
  }

  // Уровень 10: Терраса
  if (level === 10) {
    unlocks = ["terrace"];
    newFeatures = ["rare_orders_x2"];
    availableUpgrades = ["terrace_umbrella"];
  }

  // Уровень 15: Тайная комната
  if (level === 15) {
    unlocks = ["secret_room"];
    newFeatures = ["story_triggers", "unique_items"];
    availableUpgrades = ["secret_safe"];
  }

  // Уровни 16-20: Новые механики
  if (level === 16) {
    newFeatures = ["bonus_item_chance"];
  }

  return {
    level,
    xpRequired,
    unlocks,
    newFeatures,
    availableUpgrades
  };
});

export const UPGRADES: Upgrade[] = [
  {
    id: "chair_fix",
    name: "Починить стул",
    zone: "hall",
    cost: 50,
    requiredLevel: 1,
    effectType: "energy_max",
    effectValue: 5,
    description: "Увеличивает макс. энергию на 5"
  },
  {
    id: "table_fix",
    name: "Новый стол",
    zone: "hall",
    cost: 150,
    requiredLevel: 2,
    effectType: "income_bonus",
    effectValue: 0.05,
    description: "Бонус к доходу +5%"
  },
  {
    id: "kitchen_stove",
    name: "Современная плита",
    zone: "kitchen",
    cost: 500,
    requiredLevel: 5,
    effectType: "gen_speed",
    effectValue: 0.1,
    description: "Ускоряет генерацию на 10%"
  },
  {
    id: "kitchen_shelves",
    name: "Полки для специй",
    zone: "kitchen",
    cost: 300,
    requiredLevel: 7,
    effectType: "energy_max",
    effectValue: 10,
    description: "Увеличивает макс. энергию на 10"
  },
  {
    id: "terrace_umbrella",
    name: "Зонт от солнца",
    zone: "terrace",
    cost: 1200,
    requiredLevel: 10,
    effectType: "income_bonus",
    effectValue: 0.15,
    description: "Бонус к доходу +15%"
  },
  {
    id: "secret_safe",
    name: "Сейф в стене",
    zone: "secret_room",
    cost: 5000,
    requiredLevel: 15,
    effectType: "bonus_chance",
    effectValue: 0.05,
    description: "Шанс бонусного предмета +5%"
  }
];
