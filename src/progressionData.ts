import type { ActiveZone, LevelConfig, Upgrade, UpgradeZoneId } from "./types";
import { progressZoneId } from "./types";
import { getRoomVisual } from "./story/roomData";

/** Зоны на хабе «Дом»: id экрана, отображение, уровень открытия (совпадает с `unlockedZones` через progressZoneId). */
export const HUB_ZONES: {
  id: ActiveZone;
  emoji: string;
  displayName: string;
  unlockLevel: number;
}[] = [
  { id: "hall", emoji: "🏠", displayName: "Основной зал", unlockLevel: 1 },
  { id: "kitchen", emoji: "🍳", displayName: "Кухня", unlockLevel: 5 },
  { id: "bedroom", emoji: "🛏️", displayName: "Спальня", unlockLevel: 7 },
  { id: "bathroom", emoji: "🛁", displayName: "Ванная", unlockLevel: 8 },
  { id: "terrace", emoji: "🌿", displayName: "Терраса", unlockLevel: 10 },
  { id: "office", emoji: "📚", displayName: "Кабинет", unlockLevel: 12 },
  { id: "lounge", emoji: "🍷", displayName: "Бар / лаунж", unlockLevel: 14 },
  { id: "secret", emoji: "🔮", displayName: "Тайная комната", unlockLevel: 15 },
  { id: "garden", emoji: "🏡", displayName: "Сад", unlockLevel: 18 },
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

const UNLOCKS_BY_LEVEL: Partial<Record<number, string[]>> = {
  1: ["hall"],
  5: ["kitchen"],
  7: ["bedroom"],
  8: ["bathroom"],
  10: ["terrace"],
  12: ["office"],
  14: ["lounge"],
  15: ["secret_room"],
  18: ["garden"],
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

export const LEVELS: LevelConfig[] = Array.from({ length: 30 }, (_, i) => {
  const level = i + 1;
  const xpRequired = 100 + level * 20;
  const unlocks = UNLOCKS_BY_LEVEL[level] ?? [];

  let newFeatures: string[] = [];
  if (level === 1) newFeatures = ["basic_orders"];
  else if (level === 5) newFeatures = ["gen_speed_boost"];
  else if (level === 10) newFeatures = ["rare_orders_x2"];
  else if (level === 15) newFeatures = ["story_triggers", "unique_items"];
  else if (level === 16) newFeatures = ["bonus_item_chance"];

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
  v("table_fix", "Стол", "hall", 100, 2, "Как в прежние времена"),
  v("hall_window", "Шторы", "hall", 120, 3, "Уютный свет через ткань"),
  v("hall_light", "Свет", "hall", 80, 3, "Тёплый свет в зале"),
  v("hall_picture", "Картина", "hall", 90, 4, "Воспоминание на стене"),
  v("hall_rug", "Ковёр", "hall", 150, 5, "Мягко под ногами"),
  v("hall_vase", "Цветы в вазе", "hall", 130, 5, "Живое пятно цвета"),
  v("hall_clock", "Часы", "hall", 180, 5, "Тикают, как раньше"),

  // Kitchen 5–10
  v("kitchen_stove", "Плита", "kitchen", 300, 5, "Можно греть и готовить"),
  v("kitchen_shelves", "Полки", "kitchen", 200, 6, "Специи и суши"),
  v("kitchen_fridge", "Холодильник", "kitchen", 400, 7, "Продукты не испортятся"),
  v("kitchen_table", "Кухонный стол", "kitchen", 180, 8, "За столом — и завтрак, и разговоры"),
  v("kitchen_curtains", "Шторы", "kitchen", 320, 9, "Меньше солнца в глаза"),
  v("kitchen_sink", "Раковина", "kitchen", 450, 10, "Мытьё сразу у мойки — удобно"),
  v("kitchen_corner", "Кухонный уголок", "kitchen", 380, 10, "Уютный угол для чая и хлеба"),
  v("kitchen_cabinet", "Кухонный шкаф", "kitchen", 420, 11, "Всё с кухни спрячется за дверцами"),

  // Bedroom (7+)
  v("bedroom_bed", "Кровать", "bedroom", 420, 7, "Наконец-то выспаться"),
  v("bedroom_wardrobe", "Шкаф", "bedroom", 380, 7, "Одежда прячется красиво"),
  v("bedroom_lamp", "Лампа", "bedroom", 310, 8, "Тёплый свет у кровати"),
  v("bedroom_mirror", "Зеркало", "bedroom", 360, 8, "Отражение комнаты"),
  v("bedroom_rug", "Ковёр у кровати", "bedroom", 290, 9, "Мягко встать с утра"),
  v("bedroom_nightstand", "Тумбочка", "bedroom", 270, 9, "Книга и стакан воды"),
  v("bedroom_curtains", "Шторы", "bedroom", 340, 10, "Ночью темно и спокойно"),
  v("bedroom_painting", "Картина", "bedroom", 410, 10, "Характер спальни"),

  // Bathroom (8+)
  v("bathroom_bath", "Ванна", "bathroom", 520, 8, "Долгие ванны возвращаются"),
  v("bathroom_sink", "Раковина", "bathroom", 340, 8, "Чистота и порядок"),
  v("bathroom_toilet", "Туалет", "bathroom", 240, 9, "Удобство без походов в коридор"),
  v("bathroom_mirror", "Зеркало", "bathroom", 280, 9, "Утренний ритуал"),
  v("bathroom_rack", "Полка для банных", "bathroom", 310, 10, "Всё под рукой"),
  v("bathroom_mat", "Коврик", "bathroom", 190, 10, "Не скользит"),
  v("bathroom_washer", "Стиральная машина", "bathroom", 430, 10, "Стирать можно не выходя из комнаты"),
  v("bathroom_curtain", "Занавески", "bathroom", 270, 10, "Вода не брызгает наружу"),
  v("bathroom_plants", "Растения", "bathroom", 360, 11, "Зелень и влажность"),
  v("bathroom_laundry_basket", "Корзина для белья", "bathroom", 210, 11, "Грязное — отдельно, чистое — отдельно"),
  v("bathroom_light", "Подсветка", "bathroom", 320, 11, "Спокойный свет"),

  // Terrace 10–15
  v("terrace_umbrella", "Зонт", "terrace", 800, 10, "Тень в жаркий день"),
  v("terrace_plants", "Растения", "terrace", 600, 11, "Горшки и зелень"),
  v("terrace_chairs", "Стулья", "terrace", 720, 11, "Места для компании"),
  v("terrace_table", "Стол", "terrace", 880, 12, "Завтраки и вечера на свежем воздухе"),
  v("terrace_side_table", "Столик", "terrace", 480, 12, "Чай, книга, закат"),
  v("terrace_feeder", "Кормушка", "terrace", 500, 12, "Птицы заглянут"),
  v("terrace_bbq", "Барбекю гриль", "terrace", 950, 13, "Запах лета у дома"),
  v("terrace_chaise", "Кушетка", "terrace", 820, 14, "Удобно вытянуть ноги"),
  v("terrace_sunlounger", "Шезлонг", "terrace", 780, 14, "Солнце по расписанию"),

  // Office 12+
  v("office_rug", "Ковёр", "office", 700, 12, "Мягко у рабочего угла"),
  v("office_desk", "Стол", "office", 980, 12, "Рабочее место"),
  v("office_task_chair", "Кресло офисное", "office", 950, 12, "Сиденье на весь день"),
  v("office_computer", "Компьютер", "office", 1250, 13, "Связь с миром на столе"),
  v("office_sofa", "Диван", "office", 1100, 13, "Можно выдохнуть между делами"),
  v("office_coffee_table", "Кофейный столик", "office", 850, 13, "Чай и договоры в зоне отдыха"),
  v("office_chair", "Кресло обычное", "office", 920, 14, "Удобно присесть гостю"),
  v("office_globe", "Глобус", "office", 720, 14, "Планета на ладони"),
  v("office_cabinet", "Шкаф", "office", 890, 14, "Документы и книги под замком"),
  v("office_painting", "Картина", "office", 760, 15, "Характер кабинета на стене"),
  v("office_clock", "Настенные часы", "office", 680, 15, "Время под контролем"),

  // Lounge 14+
  v("lounge_bar", "Барная стойка", "lounge", 1650, 14, "Центр вечера"),
  v("lounge_bottles", "Бутылки", "lounge", 1180, 14, "Блестят на полке"),
  v("lounge_music", "Музыка", "lounge", 1320, 15, "Колонки и настроение"),
  v("lounge_sofa", "Диван", "lounge", 1850, 15, "Тонуть в подушках"),
  v("lounge_lights", "Подсветка бара", "lounge", 1120, 16, "Мягкий контур"),
  v("lounge_stools", "Табуреты", "lounge", 980, 16, "У стойки хватает места"),
  v("lounge_sign", "Вывеска", "lounge", 870, 14, "Имя места на стене"),
  v("lounge_table", "Журнальный столик", "lounge", 1420, 17, "Закуски и напитки"),

  // Secret 15–20
  v("secret_safe", "Сейф", "secret_room", 2000, 15, "Того, что внутри, не видно"),
  v("secret_documents", "Документы", "secret_room", 1500, 16, "Пожелтевшие страницы"),
  v("secret_map", "Карта", "secret_room", 1750, 16, "Отметки и загадки"),
  v("secret_clock", "Старые часы", "secret_room", 1800, 17, "Пыль на циферблате"),
  v("secret_curios", "Странные предметы", "secret_room", 2200, 18, "Никто не объяснял"),
  v("secret_desk_lamp", "Лампа", "secret_room", 1650, 17, "Свет в углу"),
  v("secret_chest", "Закрытый сундук", "secret_room", 3000, 19, "Что там внутри?"),
  v("secret_tapestry", "Гобелен", "secret_room", 2400, 19, "Сюжет из прошлого"),

  // Garden 18+
  v("garden_trees", "Деревья", "garden", 2800, 18, "Тень и шелест"),
  v("garden_paths", "Дорожки", "garden", 2400, 18, "Куда ни шаг — ровно"),
  v("garden_fountain", "Фонтан", "garden", 4200, 19, "Вода и тишина"),
  v("garden_bench", "Скамейка", "garden", 1950, 19, "Посидеть в тени"),
  v("garden_flowers", "Клумбы", "garden", 2200, 20, "Цветёт по сезону"),
  v("garden_gate", "Калитка", "garden", 3600, 20, "Вход в сад"),
  v("garden_statue", "Статуя", "garden", 4500, 21, "Хранитель аллеи"),
  v("garden_pond", "Пруд", "garden", 3800, 21, "Отражение неба"),
];

const META_UPGRADES: Upgrade[] = [
  {
    id: "meta_gen_plus_charge",
    name: "Расширенный бункер",
    zone: "meta",
    cost: 120,
    requiredLevel: 1,
    effectType: "gen_extra_charges",
    effectValue: 1,
    description: "+1 заряд ко всем генераторам на поле",
  },
  {
    id: "meta_dirty_drop_bonus",
    name: "Удачная уборка",
    zone: "meta",
    cost: 150,
    requiredLevel: 1,
    effectType: "dirty_drop_chance",
    effectValue: 0.1,
    description: "Шанс лута с грязи +10%",
  },
  {
    id: "meta_free_spawn",
    name: "Экономный жмак",
    zone: "meta",
    cost: 180,
    requiredLevel: 1,
    effectType: "free_spawn_chance",
    effectValue: 0.1,
    description: "Шанс бесплатного спавна с генератора +10% (не тратит заряд)",
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

export const META_COIN_UPGRADES: string[] = [
  "meta_gen_plus_charge",
  "meta_dirty_drop_bonus",
  "meta_free_spawn",
];

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
