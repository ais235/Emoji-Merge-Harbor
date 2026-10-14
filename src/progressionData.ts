import type { ActiveZone, LevelConfig, Upgrade, UpgradeZoneId } from "./types";
import { progressZoneId } from "./types";
import { BOX_BONUS_LOOT_COINS } from "./gameBalance";
import { getRoomVisual } from "./story/roomData";

/** Зоны на хабе «Дом»: id экрана, отображение, уровень открытия (совпадает с `unlockedZones` через progressZoneId). */
export const HUB_ZONES: {
  id: ActiveZone;
  emoji: string;
  displayName: string;
  unlockLevel: number;
}[] = [
  { id: "hall", emoji: "🏠", displayName: "Основной зал", unlockLevel: 1 },
  { id: "kitchen", emoji: "🍳", displayName: "Кухня", unlockLevel: 8 },
  { id: "bedroom", emoji: "🛏️", displayName: "Спальня", unlockLevel: 18 },
  { id: "bathroom", emoji: "🛁", displayName: "Ванная", unlockLevel: 26 },
  { id: "terrace", emoji: "🌿", displayName: "Терраса", unlockLevel: 34 },
  { id: "office", emoji: "📚", displayName: "Кабинет", unlockLevel: 42 },
  { id: "lounge", emoji: "🍷", displayName: "Бар / лаунж", unlockLevel: 50 },
  { id: "secret", emoji: "🔮", displayName: "Тайная комната", unlockLevel: 58 },
  { id: "garden", emoji: "🏡", displayName: "Сад", unlockLevel: 66 },
];

function v(
  id: string,
  name: string,
  zone: Exclude<UpgradeZoneId, "meta">,
  cost: number,
  requiredLevel: number,
  description: string
): Upgrade {
  return {
    id,
    name,
    zone,
    cost,
    requiredLevel,
    effectType: "visual",
    effectValue: 0,
    description,
  };
}

/** Держать синхронно с `HUB_ZONES.unlockLevel`. */
const UNLOCKS_BY_LEVEL: Partial<Record<number, string[]>> = {
  1: ["hall"],
  8: ["kitchen"],
  18: ["bedroom"],
  26: ["bathroom"],
  34: ["terrace"],
  42: ["office"],
  50: ["lounge"],
  58: ["secret_room"],
  66: ["garden"],
};

/** Все зоны, которые должны быть открыты при данном уровне (миграция старых сейвов и консистентность). */
export function mergeUnlockedZonesForLevel(level: number, existing: string[]): string[] {
  const set = new Set(existing);
  for (let l = 1; l <= level; l++) {
    const add = UNLOCKS_BY_LEVEL[l];
    if (add) add.forEach((z) => set.add(z));
  }
  return Array.from(set);
}

/**
 * 70 уровней: при текущей кривой 30 уровней кончались на 113-м заказе из ~423,
 * и дальше игрок не получал ни одного повышения. Формула не менялась.
 */
export const LEVELS: LevelConfig[] = Array.from({ length: 70 }, (_, i) => {
  const level = i + 1;
  const xpRequired = 100 + level * 20;
  const unlocks = UNLOCKS_BY_LEVEL[level] ?? [];

  let newFeatures: string[] = [];
  if (level === 1) newFeatures = ["basic_orders"];

  return {
    level,
    xpRequired,
    unlocks,
    newFeatures,
    availableUpgrades: [] as string[],
  };
});

/** Апгрейды комнат — только визуал на сцене; геймплейные бонусы — в `meta` внизу списка. */
const ROOM_UPGRADES: Upgrade[] = [
  // Hall 1–5
  v("chair_fix", "Стул", "hall", 50, 1, "Уютное место у стола"),
  v("table_fix", "Стол", "hall", 100, 4, "Как в прежние времена"),
  v("hall_window", "Шторы", "hall", 120, 4, "Уютный свет через ткань"),
  v("hall_light", "Свет", "hall", 80, 2, "Тёплый свет в зале"),
  v("hall_picture", "Картина", "hall", 90, 3, "Воспоминание на стене"),
  v("hall_rug", "Ковёр", "hall", 150, 6, "Мягко под ногами"),
  v("hall_vase", "Цветы в вазе", "hall", 130, 5, "Живое пятно цвета"),
  v("hall_clock", "Часы", "hall", 180, 7, "Тикают, как раньше"),

  // Kitchen 5–10
  v("kitchen_stove", "Плита", "kitchen", 300, 11, "Можно греть и готовить"),
  v("kitchen_shelves", "Полки", "kitchen", 200, 9, "Специи и суши"),
  v("kitchen_fridge", "Холодильник", "kitchen", 400, 14, "Продукты не испортятся"),
  v("kitchen_table", "Кухонный стол", "kitchen", 180, 8, "За столом — и завтрак, и разговоры"),
  v("kitchen_curtains", "Шторы", "kitchen", 320, 12, "Меньше солнца в глаза"),
  v("kitchen_sink", "Раковина", "kitchen", 450, 17, "Мытьё сразу у мойки — удобно"),
  v("kitchen_corner", "Кухонный уголок", "kitchen", 380, 13, "Уютный угол для чая и хлеба"),
  v("kitchen_cabinet", "Кухонный шкаф", "kitchen", 420, 16, "Всё с кухни спрячется за дверцами"),

  // Bedroom (7+)
  v("bedroom_bed", "Кровать", "bedroom", 800, 25, "Наконец-то выспаться"),
  v("bedroom_wardrobe", "Шкаф", "bedroom", 720, 23, "Одежда прячется красиво"),
  v("bedroom_lamp", "Лампа", "bedroom", 590, 20, "Тёплый свет у кровати"),
  v("bedroom_mirror", "Зеркало", "bedroom", 680, 22, "Отражение комнаты"),
  v("bedroom_rug", "Ковёр у кровати", "bedroom", 550, 19, "Мягко встать с утра"),
  v("bedroom_nightstand", "Тумбочка", "bedroom", 510, 18, "Книга и стакан воды"),
  v("bedroom_curtains", "Шторы", "bedroom", 650, 21, "Ночью темно и спокойно"),
  v("bedroom_painting", "Картина", "bedroom", 780, 24, "Характер спальни"),

  // Bathroom (8+)
  v("bathroom_bath", "Ванна", "bathroom", 880, 33, "Долгие ванны возвращаются"),
  v("bathroom_sink", "Раковина", "bathroom", 580, 31, "Чистота и порядок"),
  v("bathroom_toilet", "Туалет", "bathroom", 410, 27, "Удобство без походов в коридор"),
  v("bathroom_mirror", "Зеркало", "bathroom", 480, 29, "Утренний ритуал"),
  v("bathroom_rack", "Полка для банных", "bathroom", 530, 30, "Всё под рукой"),
  v("bathroom_mat", "Коврик", "bathroom", 320, 26, "Не скользит"),
  v("bathroom_washer", "Стиральная машина", "bathroom", 730, 32, "Стирать можно не выходя из комнаты"),
  v("bathroom_curtain", "Занавески", "bathroom", 460, 28, "Вода не брызгает наружу"),
  v("bathroom_plants", "Растения", "bathroom", 610, 32, "Зелень и влажность"),
  v("bathroom_laundry_basket", "Корзина для белья", "bathroom", 360, 27, "Грязное — отдельно, чистое — отдельно"),
  v("bathroom_light", "Подсветка", "bathroom", 540, 30, "Спокойный свет"),

  // Terrace 10–15
  v("terrace_umbrella", "Зонт", "terrace", 800, 38, "Тень в жаркий день"),
  v("terrace_plants", "Растения", "terrace", 600, 36, "Горшки и зелень"),
  v("terrace_chairs", "Стулья", "terrace", 720, 37, "Места для компании"),
  v("terrace_table", "Стол", "terrace", 880, 40, "Завтраки и вечера на свежем воздухе"),
  v("terrace_side_table", "Столик", "terrace", 480, 34, "Чай, книга, закат"),
  v("terrace_feeder", "Кормушка", "terrace", 500, 35, "Птицы заглянут"),
  v("terrace_bbq", "Барбекю гриль", "terrace", 950, 41, "Запах лета у дома"),
  v("terrace_chaise", "Кушетка", "terrace", 820, 39, "Удобно вытянуть ноги"),
  v("terrace_sunlounger", "Шезлонг", "terrace", 780, 38, "Солнце по расписанию"),

  // Office 12+
  v("office_rug", "Ковёр", "office", 700, 43, "Мягко у рабочего угла"),
  v("office_desk", "Стол", "office", 980, 48, "Рабочее место"),
  v("office_task_chair", "Кресло офисное", "office", 950, 47, "Сиденье на весь день"),
  v("office_computer", "Компьютер", "office", 1250, 49, "Связь с миром на столе"),
  v("office_sofa", "Диван", "office", 1100, 48, "Можно выдохнуть между делами"),
  v("office_coffee_table", "Кофейный столик", "office", 850, 45, "Чай и договоры в зоне отдыха"),
  v("office_chair", "Кресло обычное", "office", 920, 46, "Удобно присесть гостю"),
  v("office_globe", "Глобус", "office", 720, 43, "Планета на ладони"),
  v("office_cabinet", "Шкаф", "office", 890, 46, "Документы и книги под замком"),
  v("office_painting", "Картина", "office", 760, 44, "Характер кабинета на стене"),
  v("office_clock", "Настенные часы", "office", 680, 42, "Время под контролем"),

  // Lounge 14+
  v("lounge_bar", "Барная стойка", "lounge", 1650, 56, "Центр вечера"),
  v("lounge_bottles", "Бутылки", "lounge", 1180, 53, "Блестят на полке"),
  v("lounge_music", "Музыка", "lounge", 1320, 54, "Колонки и настроение"),
  v("lounge_sofa", "Диван", "lounge", 1850, 57, "Тонуть в подушках"),
  v("lounge_lights", "Подсветка бара", "lounge", 1120, 52, "Мягкий контур"),
  v("lounge_stools", "Табуреты", "lounge", 980, 51, "У стойки хватает места"),
  v("lounge_sign", "Вывеска", "lounge", 870, 50, "Имя места на стене"),
  v("lounge_table", "Журнальный столик", "lounge", 1420, 55, "Закуски и напитки"),

  // Secret 15–20
  v("secret_safe", "Сейф", "secret_room", 2000, 62, "Того, что внутри, не видно"),
  v("secret_documents", "Документы", "secret_room", 1500, 58, "Пожелтевшие страницы"),
  v("secret_map", "Карта", "secret_room", 1750, 60, "Отметки и загадки"),
  v("secret_clock", "Старые часы", "secret_room", 1800, 61, "Пыль на циферблате"),
  v("secret_curios", "Странные предметы", "secret_room", 2200, 63, "Никто не объяснял"),
  v("secret_desk_lamp", "Лампа", "secret_room", 1650, 59, "Свет в углу"),
  v("secret_chest", "Закрытый сундук", "secret_room", 3000, 65, "Что там внутри?"),
  v("secret_tapestry", "Гобелен", "secret_room", 2400, 64, "Сюжет из прошлого"),

  // Garden 18+
  v("garden_trees", "Деревья", "garden", 1760, 68, "Тень и шелест"),
  v("garden_paths", "Дорожки", "garden", 1510, 67, "Куда ни шаг — ровно"),
  v("garden_fountain", "Фонтан", "garden", 2650, 69, "Вода и тишина"),
  v("garden_bench", "Скамейка", "garden", 1230, 66, "Посидеть в тени"),
  v("garden_flowers", "Клумбы", "garden", 1390, 67, "Цветёт по сезону"),
  v("garden_gate", "Калитка", "garden", 2270, 68, "Вход в сад"),
  v("garden_statue", "Статуя", "garden", 2840, 70, "Хранитель аллеи"),
  v("garden_pond", "Пруд", "garden", 2390, 69, "Отражение неба"),
];

const META_UPGRADES: Upgrade[] = [
  {
    id: "meta_gen_plus_charge_i",
    name: "Макс. энергия +10 (I)",
    zone: "meta",
    cost: 120,
    requiredLevel: 1,
    effectType: "energy_max",
    effectValue: 10,
    description:
      "Поднимает потолок энергии на +10 (при базе 60: было 60/60 → станет 70/70). Спавн с генератора по-прежнему тратит 1 энергию за нажатие.",
  },
  {
    id: "meta_gen_plus_charge_ii",
    name: "Макс. энергия +15 (II)",
    zone: "meta",
    cost: 280,
    requiredLevel: 12,
    effectType: "energy_max",
    effectValue: 15,
    description: "Ещё +10 к максимуму энергии (складывается с другими уровнями этого улучшения).",
  },
  {
    id: "meta_gen_plus_charge_iii",
    name: "Макс. энергия +15 (III)",
    zone: "meta",
    cost: 560,
    requiredLevel: 24,
    effectType: "energy_max",
    effectValue: 15,
    description: "Ещё +15 к максимуму энергии.",
  },
  {
    id: "meta_dirty_drop_bonus_i",
    name: "Ящики: находки (I)",
    zone: "meta",
    cost: 150,
    requiredLevel: 1,
    effectType: "box_loot_chance",
    effectValue: 0.12,
    description: `Шанс 12%, что в открытом ящике найдётся ещё ${BOX_BONUS_LOOT_COINS} монет.`,
  },
  {
    id: "meta_dirty_drop_bonus_ii",
    name: "Ящики: находки (II)",
    zone: "meta",
    cost: 340,
    requiredLevel: 6,
    effectType: "box_loot_chance",
    effectValue: 0.13,
    description: "Ещё +13% к шансу найти монеты в ящике.",
  },
  {
    id: "meta_dirty_drop_bonus_iii",
    name: "Ящики: находки (III)",
    zone: "meta",
    cost: 680,
    requiredLevel: 10,
    effectType: "box_loot_chance",
    effectValue: 0.15,
    description: "Финальный бонус: ещё +15% к шансу находки.",
  },
  {
    id: "meta_free_spawn_i",
    name: "Генераторы: бесплатный спавн (I)",
    zone: "meta",
    cost: 180,
    requiredLevel: 1,
    effectType: "free_spawn_chance",
    effectValue: 0.08,
    description: "Шанс 8%, что генератор выдаст предмет и не потратит энергию.",
  },
  {
    id: "meta_free_spawn_ii",
    name: "Генераторы: бесплатный спавн (II)",
    zone: "meta",
    cost: 360,
    requiredLevel: 6,
    effectType: "free_spawn_chance",
    effectValue: 0.1,
    description: "Ещё +10% к бесплатному спавну.",
  },
  {
    id: "meta_free_spawn_iii",
    name: "Генераторы: бесплатный спавн (III)",
    zone: "meta",
    cost: 760,
    requiredLevel: 11,
    effectType: "free_spawn_chance",
    effectValue: 0.12,
    description: "Финальный бонус: ещё +12% к бесплатному спавну.",
  },
  {
    id: "meta_income_i",
    name: "Доход с заказов +10% (I)",
    zone: "meta",
    cost: 220,
    requiredLevel: 3,
    effectType: "income_bonus",
    effectValue: 0.1,
    description: "Каждый выполненный заказ приносит на 10% больше монет.",
  },
  {
    id: "meta_income_ii",
    name: "Доход с заказов +15% (II)",
    zone: "meta",
    cost: 480,
    requiredLevel: 8,
    effectType: "income_bonus",
    effectValue: 0.15,
    description: "Ещё +15% к монетам за заказ (складывается).",
  },
  {
    id: "meta_income_iii",
    name: "Доход с заказов +20% (III)",
    zone: "meta",
    cost: 900,
    requiredLevel: 13,
    effectType: "income_bonus",
    effectValue: 0.2,
    description: "Ещё +20% к монетам за заказ.",
  },
  {
    id: "meta_lucky_tip_i",
    name: "Щедрые гости (I)",
    zone: "meta",
    cost: 300,
    requiredLevel: 5,
    effectType: "bonus_chance",
    effectValue: 0.1,
    description: "Шанс 10%, что гость оставит чаевые и удвоит монеты за заказ.",
  },
  {
    id: "meta_lucky_tip_ii",
    name: "Щедрые гости (II)",
    zone: "meta",
    cost: 640,
    requiredLevel: 10,
    effectType: "bonus_chance",
    effectValue: 0.12,
    description: "Ещё +12% к шансу удвоить монеты за заказ.",
  },
];

export const UPGRADES: Upgrade[] = [...ROOM_UPGRADES, ...META_UPGRADES];

/** Старые id апгрейдов → актуальные (миграция сохранений). */
const LEGACY_UPGRADE_ID_MAP: Record<string, string> = {
  kitchen_bar_stool: "kitchen_table",
  kitchen_hood: "kitchen_sink",
  bathroom_towels: "bathroom_toilet",
  terrace_furniture: "terrace_table",
  office_books: "office_cabinet",
  office_shelf: "office_cabinet",
  office_lamp: "office_coffee_table",
  office_art: "office_painting",
  meta_gen_plus_charge: "meta_gen_plus_charge_i",
  meta_dirty_drop_bonus: "meta_dirty_drop_bonus_i",
  meta_free_spawn: "meta_free_spawn_i",
};

const REMOVED_UPGRADE_IDS = new Set<string>([
  "kitchen_dishes",
  "terrace_railings",
  "terrace_lantern",
  "terrace_floor",
  "terrace_garlands",
]);

export function migrateLegacyUpgradeIds(purchased: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of purchased) {
    if (REMOVED_UPGRADE_IDS.has(id)) continue;
    const mapped = LEGACY_UPGRADE_ID_MAP[id] ?? id;
    if (REMOVED_UPGRADE_IDS.has(mapped)) continue;
    if (!seen.has(mapped)) {
      seen.add(mapped);
      out.push(mapped);
    }
  }
  return out;
}

export const META_COIN_UPGRADES: string[] = META_UPGRADES.map((u) => u.id);

/** Куплено предметов интерьера комнаты / всего по сцене (слои) или по списку апгрейдов зоны. */
export function roomFurnitureProgress(
  zoneId: ActiveZone,
  purchasedUpgradeIds: string[]
): { bought: number; total: number } {
  const visual = getRoomVisual(zoneId);
  const layers = visual?.layers ?? [];
  if (layers.length > 0) {
    const bought = layers.filter((l) => purchasedUpgradeIds.includes(l.upgradeId)).length;
    return { bought, total: layers.length };
  }
  const pid = progressZoneId(zoneId);
  const list = UPGRADES.filter((u) => u.zone === pid);
  const bought = list.filter((u) => purchasedUpgradeIds.includes(u.id)).length;
  return { bought, total: list.length };
}
