/**
 * Цепочки слияний по комнатам и генераторы (см. docs/komnaty-generatory-tsepochki.md).
 * Не импортирует ./types, чтобы избежать циклических зависимостей.
 */

export const ROOM_CHAIN_LEN = 7;

function ra(level: number): "common" | "rare" | "epic" {
  if (level <= 2) return "common";
  if (level <= 5) return "rare";
  return "epic";
}

function xpForLevel(level: number): number {
  return 2 ** (level - 1);
}

function coinForLevel(level: number): number {
  return 2 ** level;
}

function mergeable(
  id: string,
  name: string,
  emoji: string,
  chain: string,
  level: number,
  description?: string
) {
  const o: Record<string, unknown> = {
    id,
    name,
    emoji,
    chain,
    level,
    xpReward: xpForLevel(level),
    coinReward: coinForLevel(level),
    rarity: ra(level),
  };
  if (description) o.description = description;
  return o;
}

/** id цепочки → описание для коллекции и ITEM_CHAINS. */
export const ROOM_MERGE_CHAINS: Record<
  string,
  { id: string; name: string; items: ReturnType<typeof mergeable>[] }
> = {
  hall_tea: {
    id: "hall_tea",
    name: "Основной зал: чай и сервировка",
    items: [
      mergeable("hl1", "Чайник", "🫖", "hall_tea", 1, "Начало тёплого приёма."),
      mergeable("hl2", "Ложка", "🥄", "hall_tea", 2),
      mergeable("hl3", "Вилка и нож", "🍴", "hall_tea", 3),
      mergeable("hl4", "Тарелка с приборами", "🍽️", "hall_tea", 4),
      mergeable("hl5", "Чашка чая", "🍵", "hall_tea", 5),
      mergeable("hl6", "Наливание напитка", "🫗", "hall_tea", 6),
      mergeable("hl7", "Бабл-ти", "🧋", "hall_tea", 7, "Коронный напиток зала."),
    ],
  },
  kitchen_meal: {
    id: "kitchen_meal",
    name: "Кухня: от овощей к ужину",
    items: [
      mergeable("kt1", "Лук", "🧅", "kitchen_meal", 1),
      mergeable("kt2", "Морковь", "🥕", "kitchen_meal", 2),
      mergeable("kt3", "Картофель", "🥔", "kitchen_meal", 3),
      mergeable("kt4", "Баклажан", "🍆", "kitchen_meal", 4),
      mergeable("kt5", "Болгарский перец", "🫑", "kitchen_meal", 5),
      mergeable("kt6", "Брокколи", "🥦", "kitchen_meal", 6),
      mergeable("kt7", "Горячее в кастрюле", "🍲", "kitchen_meal", 7, "Суп готов."),
    ],
  },
  bedroom_cozy: {
    id: "bedroom_cozy",
    name: "Спальня: вечер и сон",
    items: [
      mergeable("bd1", "Плюшевый мишка", "🧸", "bedroom_cozy", 1),
      mergeable("bd2", "Книги", "📚", "bedroom_cozy", 2),
      mergeable("bd3", "Песочные часы", "⏳", "bedroom_cozy", 3),
      mergeable("bd4", "Настенные часы", "🕰️", "bedroom_cozy", 4),
      mergeable("bd5", "Сон", "💤", "bedroom_cozy", 5),
      mergeable("bd6", "Ночной город", "🌃", "bedroom_cozy", 6),
      mergeable("bd7", "Отдых в кровати", "🛌", "bedroom_cozy", 7),
    ],
  },
  bathroom_fresh: {
    id: "bathroom_fresh",
    name: "Ванная: свежесть и уход",
    items: [
      mergeable("bt1", "Капля воды", "💧", "bathroom_fresh", 1),
      mergeable("bt2", "Губка", "🧽", "bathroom_fresh", 2),
      mergeable("bt3", "Мыло", "🧼", "bathroom_fresh", 3),
      mergeable("bt4", "Пузырьки", "🫧", "bathroom_fresh", 4),
      mergeable("bt5", "Лосьон или шампунь", "🧴", "bathroom_fresh", 5),
      mergeable("bt6", "Зубная щётка", "🪥", "bathroom_fresh", 6),
      mergeable("bt7", "Ванна", "🛁", "bathroom_fresh", 7),
    ],
  },
  terrace_plants: {
    id: "terrace_plants",
    name: "Терраса: зелень",
    items: [
      mergeable("tr1", "Росток", "🌱", "terrace_plants", 1),
      mergeable("tr2", "Растение в горшке", "🪴", "terrace_plants", 2),
      mergeable("tr3", "Зелень", "🌿", "terrace_plants", 3),
      mergeable("tr4", "Колосья", "🌾", "terrace_plants", 4),
      mergeable("tr5", "Тюльпан", "🌷", "terrace_plants", 5),
      mergeable("tr6", "Роза", "🌹", "terrace_plants", 6),
      mergeable("tr7", "Подсолнух", "🌻", "terrace_plants", 7),
    ],
  },
  office_work: {
    id: "office_work",
    name: "Кабинет: от заметки к проекту",
    items: [
      mergeable("of1", "Карандаш", "✏️", "office_work", 1),
      mergeable("of2", "Заметка", "📝", "office_work", 2),
      mergeable("of3", "Лист бумаги", "📄", "office_work", 3),
      mergeable("of4", "Тетрадь", "📓", "office_work", 4),
      mergeable("of5", "Скрепка", "📎", "office_work", 5),
      mergeable("of6", "Связанные скрепки", "🖇️", "office_work", 6),
      mergeable("of7", "Папка с документами", "📂", "office_work", 7),
    ],
  },
  lounge_drinks: {
    id: "lounge_drinks",
    name: "Бар / лаунж: напитки",
    items: [
      mergeable("ln1", "Лёд в кубиках", "🧊", "lounge_drinks", 1),
      mergeable("ln2", "Коктейль в стакане", "🥃", "lounge_drinks", 2),
      mergeable("ln3", "Тропический коктейль", "🍹", "lounge_drinks", 3),
      mergeable("ln4", "Кружка пива", "🍺", "lounge_drinks", 4),
      mergeable("ln5", "Чокающиеся кружки", "🍻", "lounge_drinks", 5),
      mergeable("ln6", "Шампанское", "🍾", "lounge_drinks", 6),
      mergeable("ln7", "Чокающиеся бокалы", "🥂", "lounge_drinks", 7),
    ],
  },
  secret_mystic: {
    id: "secret_mystic",
    name: "Тайная комната: мистика",
    items: [
      mergeable("sc1", "Свеча", "🕯️", "secret_mystic", 1),
      mergeable("sc2", "Свиток", "📜", "secret_mystic", 2),
      mergeable("sc3", "Волшебная палочка", "🪄", "secret_mystic", 3),
      mergeable("sc4", "Звезда", "⭐", "secret_mystic", 4),
      mergeable("sc5", "Сияющая звезда", "🌟", "secret_mystic", 5),
      mergeable("sc6", "Искры", "✨", "secret_mystic", 6),
      mergeable("sc7", "Ночное небо", "🌌", "secret_mystic", 7),
    ],
  },
  garden_harvest: {
    id: "garden_harvest",
    name: "Сад: грядка и урожай",
    items: [
      mergeable("gn1", "Листовая зелень", "🥬", "garden_harvest", 1),
      mergeable("gn2", "Огурец", "🥒", "garden_harvest", 2),
      mergeable("gn3", "Кукуруза", "🌽", "garden_harvest", 3),
      mergeable("gn4", "Помидор", "🍅", "garden_harvest", 4),
      mergeable("gn5", "Горох в стручке", "🫛", "garden_harvest", 5),
      mergeable("gn6", "Арахис", "🥜", "garden_harvest", 6),
      mergeable("gn7", "Батат", "🍠", "garden_harvest", 7),
    ],
  },
};

export const ZONE_TO_MERGE_CHAIN_ID = {
  hall: "hall_tea",
  kitchen: "kitchen_meal",
  bedroom: "bedroom_cozy",
  bathroom: "bathroom_fresh",
  terrace: "terrace_plants",
  office: "office_work",
  lounge: "lounge_drinks",
  secret: "secret_mystic",
  garden: "garden_harvest",
} as const;

export type CatalogZone = keyof typeof ZONE_TO_MERGE_CHAIN_ID;

/** Генераторы комнат: id предмета → какую цепочку спавнить. */
export const ROOM_GENERATOR_DEFS: Record<
  string,
  { id: string; name: string; emoji: string; spawnsChainId: string }
> = {
  gen_hall: {
    id: "gen_hall",
    name: "Настольный звонок",
    emoji: "🛎️",
    spawnsChainId: "hall_tea",
  },
  gen_kitchen: {
    id: "gen_kitchen",
    name: "Плита",
    emoji: "🍳",
    spawnsChainId: "kitchen_meal",
  },
  gen_bedroom: {
    id: "gen_bedroom",
    name: "Луна",
    emoji: "🌙",
    spawnsChainId: "bedroom_cozy",
  },
  gen_bathroom: {
    id: "gen_bathroom",
    name: "Душ",
    emoji: "🚿",
    spawnsChainId: "bathroom_fresh",
  },
  gen_terrace: {
    id: "gen_terrace",
    name: "Стул на террасе",
    emoji: "🪑",
    spawnsChainId: "terrace_plants",
  },
  gen_office: {
    id: "gen_office",
    name: "Портфель",
    emoji: "💼",
    spawnsChainId: "office_work",
  },
  gen_lounge: {
    id: "gen_lounge",
    name: "Коктейльный бокал",
    emoji: "🍸",
    spawnsChainId: "lounge_drinks",
  },
  gen_secret: {
    id: "gen_secret",
    name: "Хрустальный шар",
    emoji: "🔮",
    spawnsChainId: "secret_mystic",
  },
  gen_garden: {
    id: "gen_garden",
    name: "Садовые перчатки",
    emoji: "🧤",
    spawnsChainId: "garden_harvest",
  },
};

export const ZONE_TO_GENERATOR_ID: Record<CatalogZone, string> = {
  hall: "gen_hall",
  kitchen: "gen_kitchen",
  bedroom: "gen_bedroom",
  bathroom: "gen_bathroom",
  terrace: "gen_terrace",
  office: "gen_office",
  lounge: "gen_lounge",
  secret: "gen_secret",
  garden: "gen_garden",
};
