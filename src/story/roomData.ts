/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ActiveZone } from "../types";

export type FurnitureLayer = {
  upgradeId: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
  size: number;
  /** По умолчанию `/rooms/<zone>/<upgradeId>.png` — см. `roomLayer`, `public/rooms/README.md` */
  imageSrc?: string;
};

export type RoomVisual = {
  zoneId: ActiveZone;
  bgColor: string;
  bgEmoji: string;
  /** Путь от корня сайта, например `/rooms/hall-bg.png` (файл в `public/rooms/`) */
  bgImage?: string;
  layers: FurnitureLayer[];
};

/** Спрайт: положите файл `public/rooms/<zone>/<upgradeId>.png` — он подхватится без правок этого поля. */
function roomLayer(
  zoneId: ActiveZone,
  layer: Pick<FurnitureLayer, "upgradeId" | "emoji" | "label" | "x" | "y" | "size"> &
    Partial<Pick<FurnitureLayer, "imageSrc">>,
): FurnitureLayer {
  return {
    ...layer,
    imageSrc: layer.imageSrc ?? `/rooms/${zoneId}/${layer.upgradeId}.png`,
  };
}

/**
 * upgradeId совпадают с progressionData.ts (UPGRADES).
 */
export const ROOM_VISUALS: RoomVisual[] = [
  {
    zoneId: "hall",
    bgColor: "#FFF8F0",
    bgEmoji: "🏠",
    bgImage: "/rooms/hall-bg.png",
    layers: [
      roomLayer("hall", { upgradeId: "hall_rug", emoji: "🟫", label: "Ковёр", x: 48.14, y: 65.73, size: 119 }),
      roomLayer("hall", { upgradeId: "chair_fix", emoji: "🪑", label: "Стул", x: 43.4, y: 52.09, size: 30 }),
      roomLayer("hall", { upgradeId: "table_fix", emoji: "🍽️", label: "Стол", x: 34.73, y: 47.45, size: 63 }),
      roomLayer("hall", { upgradeId: "hall_window", emoji: "🎀", label: "Шторы", x: 71.02, y: 38.45, size: 61 }),
      roomLayer("hall", { upgradeId: "hall_light", emoji: "🕯️", label: "Свет", x: 83.87, y: 53.36, size: 26 }),
      roomLayer("hall", { upgradeId: "hall_picture", emoji: "🖼️", label: "Картина", x: 30.72, y: 30.73, size: 23 }),
      roomLayer("hall", { upgradeId: "hall_vase", emoji: "🏺", label: "Ваза", x: 38.06, y: 33.64, size: 25 }),
      roomLayer("hall", { upgradeId: "hall_clock", emoji: "🕰️", label: "Часы", x: 55.73, y: 20.27, size: 21 }),
    ],
  },
  {
    zoneId: "kitchen",
    bgColor: "#F0FFF4",
    bgEmoji: "🍳",
    layers: [
      roomLayer("kitchen", { upgradeId: "kitchen_stove", emoji: "🔥", label: "Плита", x: 18, y: 48, size: 34 }),
      roomLayer("kitchen", { upgradeId: "kitchen_shelves", emoji: "🧂", label: "Полки", x: 48, y: 32, size: 32 }),
      roomLayer("kitchen", { upgradeId: "kitchen_fridge", emoji: "🧊", label: "Холодильник", x: 82, y: 44, size: 34 }),
      roomLayer("kitchen", { upgradeId: "kitchen_dishes", emoji: "🍴", label: "Посуда", x: 58, y: 52, size: 28 }),
      roomLayer("kitchen", { upgradeId: "kitchen_bar_stool", emoji: "🪑", label: "Барный стул", x: 32, y: 72, size: 28 }),
      roomLayer("kitchen", { upgradeId: "kitchen_curtains", emoji: "🪟", label: "Шторы", x: 72, y: 22, size: 30 }),
      roomLayer("kitchen", { upgradeId: "kitchen_hood", emoji: "💨", label: "Вытяжка", x: 18, y: 26, size: 30 }),
    ],
  },
  {
    zoneId: "bedroom",
    bgColor: "#FAF5FF",
    bgEmoji: "🛏️",
    layers: [
      roomLayer("bedroom", { upgradeId: "bedroom_bed", emoji: "🛏️", label: "Кровать", x: 48, y: 58, size: 40 }),
      roomLayer("bedroom", { upgradeId: "bedroom_wardrobe", emoji: "🚪", label: "Шкаф", x: 14, y: 44, size: 34 }),
      roomLayer("bedroom", { upgradeId: "bedroom_lamp", emoji: "💡", label: "Лампа", x: 72, y: 36, size: 28 }),
      roomLayer("bedroom", { upgradeId: "bedroom_mirror", emoji: "🪞", label: "Зеркало", x: 84, y: 42, size: 30 }),
      roomLayer("bedroom", { upgradeId: "bedroom_rug", emoji: "🟪", label: "Ковёр", x: 46, y: 78, size: 32 }),
      roomLayer("bedroom", { upgradeId: "bedroom_nightstand", emoji: "🗄️", label: "Тумба", x: 68, y: 68, size: 26 }),
      roomLayer("bedroom", { upgradeId: "bedroom_curtains", emoji: "🎀", label: "Шторы", x: 26, y: 24, size: 28 }),
      roomLayer("bedroom", { upgradeId: "bedroom_painting", emoji: "🖼️", label: "Картина", x: 58, y: 22, size: 28 }),
    ],
  },
  {
    zoneId: "bathroom",
    bgColor: "#EFF6FF",
    bgEmoji: "🛁",
    layers: [
      roomLayer("bathroom", { upgradeId: "bathroom_bath", emoji: "🛁", label: "Ванна", x: 22, y: 56, size: 38 }),
      roomLayer("bathroom", { upgradeId: "bathroom_sink", emoji: "🚰", label: "Раковина", x: 56, y: 48, size: 32 }),
      roomLayer("bathroom", { upgradeId: "bathroom_towels", emoji: "🧺", label: "Полотенца", x: 78, y: 52, size: 28 }),
      roomLayer("bathroom", { upgradeId: "bathroom_mirror", emoji: "🪞", label: "Зеркало", x: 58, y: 28, size: 30 }),
      roomLayer("bathroom", { upgradeId: "bathroom_rack", emoji: "🧴", label: "Полка", x: 84, y: 36, size: 26 }),
      roomLayer("bathroom", { upgradeId: "bathroom_mat", emoji: "⬜", label: "Коврик", x: 56, y: 76, size: 32 }),
      roomLayer("bathroom", { upgradeId: "bathroom_plants", emoji: "🪴", label: "Растения", x: 14, y: 44, size: 28 }),
      roomLayer("bathroom", { upgradeId: "bathroom_light", emoji: "💡", label: "Свет", x: 40, y: 20, size: 24 }),
    ],
  },
  {
    zoneId: "terrace",
    bgColor: "#F0FFF8",
    bgEmoji: "🌿",
    layers: [
      roomLayer("terrace", { upgradeId: "terrace_umbrella", emoji: "☂️", label: "Зонт", x: 46, y: 38, size: 40 }),
      roomLayer("terrace", { upgradeId: "terrace_plants", emoji: "🌺", label: "Растения", x: 16, y: 64, size: 30 }),
      roomLayer("terrace", { upgradeId: "terrace_railings", emoji: "🚧", label: "Перила", x: 88, y: 50, size: 28 }),
      roomLayer("terrace", { upgradeId: "terrace_furniture", emoji: "🪑", label: "Мебель", x: 58, y: 68, size: 32 }),
      roomLayer("terrace", { upgradeId: "terrace_garlands", emoji: "✨", label: "Гирлянды", x: 30, y: 22, size: 28 }),
      roomLayer("terrace", { upgradeId: "terrace_feeder", emoji: "🐦", label: "Кормушка", x: 12, y: 36, size: 28 }),
      roomLayer("terrace", { upgradeId: "terrace_lantern", emoji: "🏮", label: "Фонарь", x: 78, y: 28, size: 30 }),
      roomLayer("terrace", { upgradeId: "terrace_floor", emoji: "🟫", label: "Настил", x: 48, y: 82, size: 36 }),
    ],
  },
  {
    zoneId: "office",
    bgColor: "#F8FAFC",
    bgEmoji: "📚",
    layers: [
      roomLayer("office", { upgradeId: "office_desk", emoji: "📋", label: "Стол", x: 44, y: 58, size: 34 }),
      roomLayer("office", { upgradeId: "office_books", emoji: "📚", label: "Книги", x: 18, y: 40, size: 34 }),
      roomLayer("office", { upgradeId: "office_computer", emoji: "💻", label: "Компьютер", x: 52, y: 48, size: 30 }),
      roomLayer("office", { upgradeId: "office_chair", emoji: "🪑", label: "Кресло", x: 44, y: 74, size: 30 }),
      roomLayer("office", { upgradeId: "office_lamp", emoji: "🔦", label: "Лампа", x: 72, y: 32, size: 26 }),
      roomLayer("office", { upgradeId: "office_shelf", emoji: "📗", label: "Стеллаж", x: 82, y: 48, size: 32 }),
      roomLayer("office", { upgradeId: "office_art", emoji: "🎨", label: "Постер", x: 28, y: 26, size: 28 }),
      roomLayer("office", { upgradeId: "office_clock", emoji: "🕒", label: "Часы", x: 88, y: 24, size: 26 }),
    ],
  },
  {
    zoneId: "lounge",
    bgColor: "#1E1528",
    bgEmoji: "🍷",
    layers: [
      roomLayer("lounge", { upgradeId: "lounge_bar", emoji: "🥃", label: "Бар", x: 48, y: 44, size: 36 }),
      roomLayer("lounge", { upgradeId: "lounge_bottles", emoji: "🍾", label: "Бутылки", x: 68, y: 38, size: 30 }),
      roomLayer("lounge", { upgradeId: "lounge_music", emoji: "🎵", label: "Музыка", x: 22, y: 30, size: 30 }),
      roomLayer("lounge", { upgradeId: "lounge_sofa", emoji: "🛋️", label: "Диван", x: 52, y: 70, size: 38 }),
      roomLayer("lounge", { upgradeId: "lounge_lights", emoji: "💡", label: "Свет", x: 38, y: 20, size: 24 }),
      roomLayer("lounge", { upgradeId: "lounge_stools", emoji: "🪑", label: "Табуреты", x: 28, y: 52, size: 26 }),
      roomLayer("lounge", { upgradeId: "lounge_sign", emoji: "📜", label: "Вывеска", x: 82, y: 26, size: 28 }),
      roomLayer("lounge", { upgradeId: "lounge_table", emoji: "☕", label: "Столик", x: 14, y: 68, size: 28 }),
    ],
  },
  {
    zoneId: "secret",
    bgColor: "#F5F0FF",
    bgEmoji: "🔮",
    layers: [
      roomLayer("secret", { upgradeId: "secret_safe", emoji: "🗝️", label: "Сейф", x: 22, y: 54, size: 36 }),
      roomLayer("secret", { upgradeId: "secret_documents", emoji: "📜", label: "Документы", x: 58, y: 48, size: 30 }),
      roomLayer("secret", { upgradeId: "secret_map", emoji: "🗺️", label: "Карта", x: 78, y: 36, size: 30 }),
      roomLayer("secret", { upgradeId: "secret_clock", emoji: "🕰️", label: "Часы", x: 14, y: 28, size: 30 }),
      roomLayer("secret", { upgradeId: "secret_curios", emoji: "🧪", label: "Странное", x: 86, y: 62, size: 30 }),
      roomLayer("secret", { upgradeId: "secret_desk_lamp", emoji: "🔦", label: "Лампа", x: 42, y: 28, size: 26 }),
      roomLayer("secret", { upgradeId: "secret_chest", emoji: "📦", label: "Сундук", x: 52, y: 72, size: 36 }),
      roomLayer("secret", { upgradeId: "secret_tapestry", emoji: "🧵", label: "Гобелен", x: 42, y: 18, size: 28 }),
    ],
  },
  {
    zoneId: "garden",
    bgColor: "#E8F5E9",
    bgEmoji: "🏡",
    layers: [
      roomLayer("garden", { upgradeId: "garden_trees", emoji: "🌳", label: "Деревья", x: 18, y: 38, size: 36 }),
      roomLayer("garden", { upgradeId: "garden_paths", emoji: "🛤️", label: "Дорожки", x: 48, y: 78, size: 34 }),
      roomLayer("garden", { upgradeId: "garden_fountain", emoji: "⛲", label: "Фонтан", x: 52, y: 44, size: 40 }),
      roomLayer("garden", { upgradeId: "garden_bench", emoji: "🪑", label: "Скамейка", x: 78, y: 56, size: 32 }),
      roomLayer("garden", { upgradeId: "garden_flowers", emoji: "🌸", label: "Цветы", x: 24, y: 68, size: 30 }),
      roomLayer("garden", { upgradeId: "garden_gate", emoji: "🚧", label: "Калитка", x: 88, y: 42, size: 30 }),
      roomLayer("garden", { upgradeId: "garden_statue", emoji: "🗿", label: "Статуя", x: 14, y: 58, size: 34 }),
      roomLayer("garden", { upgradeId: "garden_pond", emoji: "💧", label: "Пруд", x: 72, y: 74, size: 36 }),
    ],
  },
];

export function getRoomVisual(zone: ActiveZone): RoomVisual | undefined {
  return ROOM_VISUALS.find((r) => r.zoneId === zone);
}
