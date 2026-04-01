import type { ActiveZone, LevelConfig, Upgrade, UpgradeZoneId } from "./types";

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
  v("kitchen_dishes", "Посуда", "kitchen", 250, 8, "Стопки тарелок, как в кафе"),
  v("kitchen_bar_stool", "Барный стул", "kitchen", 180, 9, "Удобно у стойки"),
  v("kitchen_curtains", "Шторы", "kitchen", 320, 9, "Меньше солнца в глаза"),
  v("kitchen_hood", "Вытяжка", "kitchen", 450, 10, "На кухне не душно"),

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
  v("bathroom_towels", "Полотенца", "bathroom", 220, 9, "Мягкие и свежие"),
  v("bathroom_mirror", "Зеркало", "bathroom", 280, 9, "Утренний ритуал"),
  v("bathroom_rack", "Полка для банных", "bathroom", 310, 10, "Всё под рукой"),
  v("bathroom_mat", "Коврик", "bathroom", 190, 10, "Не скользит"),
  v("bathroom_plants", "Растения", "bathroom", 360, 11, "Зелень и влажность"),
  v("bathroom_light", "Подсветка", "bathroom", 320, 11, "Спокойный свет"),

  // Terrace 10–15
  v("terrace_umbrella", "Зонт", "terrace", 800, 10, "Тень в жаркий день"),
  v("terrace_plants", "Растения", "terrace", 600, 11, "Горшки и зелень"),
  v("terrace_railings", "Перила", "terrace", 750, 11, "Аккуратный контур"),
  v("terrace_furniture", "Садовая мебель", "terrace", 900, 12, "Стол и кресла снаружи"),
  v("terrace_garlands", "Гирлянды", "terrace", 700, 13, "Вечером красиво"),
  v("terrace_feeder", "Кормушка", "terrace", 500, 12, "Птицы заглянут"),
  v("terrace_lantern", "Фонарь", "terrace", 850, 14, "Уютный свет"),
  v("terrace_floor", "Настил", "terrace", 920, 14, "Ровная поверхность"),

  // Office 12+
  v("office_desk", "Стол", "office", 980, 12, "Рабочее место"),
  v("office_books", "Книги", "office", 850, 12, "Полки забиты знаниями"),
  v("office_computer", "Компьютер", "office", 1250, 13, "Современная связь"),
  v("office_chair", "Кресло", "office", 920, 13, "Удобно сидеть часами"),
  v("office_lamp", "Настольная лампа", "office", 720, 14, "Свет на документах"),
  v("office_shelf", "Стеллаж", "office", 890, 14, "Порядок в бумагах"),
  v("office_art", "Постер", "office", 760, 15, "Вдохновение на стене"),
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

export const META_COIN_UPGRADES: string[] = [
  "meta_gen_plus_charge",
  "meta_dirty_drop_bonus",
  "meta_free_spawn",
];
