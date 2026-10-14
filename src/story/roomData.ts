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
      roomLayer("hall", { upgradeId: "hall_rug", emoji: "🟫", label: "Ковёр", x: 52.83, y: 66.55, size: 119 }),
      roomLayer("hall", { upgradeId: "chair_fix", emoji: "🪑", label: "Стул", x: 43.4, y: 52.09, size: 30 }),
      roomLayer("hall", { upgradeId: "table_fix", emoji: "🍽️", label: "Стол", x: 35.55, y: 49.35, size: 63 }),
      roomLayer("hall", { upgradeId: "hall_window", emoji: "🎀", label: "Шторы", x: 67.55, y: 40.35, size: 70 }),
      roomLayer("hall", { upgradeId: "hall_light", emoji: "🕯️", label: "Свет", x: 77.34, y: 53.09, size: 26 }),
      roomLayer("hall", { upgradeId: "hall_picture", emoji: "🖼️", label: "Картина", x: 30.72, y: 38.35, size: 23 }),
      roomLayer("hall", { upgradeId: "hall_vase", emoji: "🏺", label: "Ваза", x: 37.65, y: 41.8, size: 25 }),
      roomLayer("hall", { upgradeId: "hall_clock", emoji: "🕰️", label: "Часы", x: 54.51, y: 27.07, size: 21 }),
    ],
  },
  {
    zoneId: "kitchen",
    bgColor: "#F0FFF4",
    bgEmoji: "🍳",
    bgImage: "/rooms/kitchen-bg.png",
    layers: [
      /* Порядок: раньше в массиве = ниже по z. Слои перечислены в обратном порядке относительно предыдущей раскладки. */
      roomLayer("kitchen", { upgradeId: "kitchen_corner", emoji: "🛋️", label: "Кухонный уголок", x: 49.24, y: 41.55, size: 88 }),
      roomLayer("kitchen", { upgradeId: "kitchen_table", emoji: "🍽️", label: "Кухонный стол", x: 44.5, y: 67.45, size: 76 }),
      roomLayer("kitchen", { upgradeId: "kitchen_stove", emoji: "🔥", label: "Плита", x: 59.28, y: 43.45, size: 34 }),
      roomLayer("kitchen", { upgradeId: "kitchen_sink", emoji: "🚰", label: "Раковина", x: 66.26, y: 51, size: 66 }),
      roomLayer("kitchen", { upgradeId: "kitchen_fridge", emoji: "🧊", label: "Холодильник", x: 75.31, y: 51.27, size: 45 }),
      roomLayer("kitchen", { upgradeId: "kitchen_curtains", emoji: "🪟", label: "Шторы", x: 27.23, y: 38.36, size: 57 }),
      roomLayer("kitchen", { upgradeId: "kitchen_shelves", emoji: "🧂", label: "Полки", x: 41.31, y: 23.36, size: 32 }),
      roomLayer("kitchen", { upgradeId: "kitchen_cabinet", emoji: "🗄️", label: "Кухонный шкаф", x: 15.36, y: 55, size: 59 }),
    ],
  },
  {
    zoneId: "bedroom",
    bgColor: "#FAF5FF",
    bgEmoji: "🛏️",
    bgImage: "/rooms/bedroom-bg.png",
    layers: [
      /* z: первый в массиве — самый дальний слой: шкаф → ковёр → зеркало → … → шторы */
      roomLayer("bedroom", {
        upgradeId: "bedroom_wardrobe",
        emoji: "🚪",
        label: "Шкаф",
        x: 53.83,
        y: 34.91,
        size: 49,
        imageSrc: "/rooms/bedroom/bedroom_wardrobe.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_rug",
        emoji: "🟪",
        label: "Ковёр",
        x: 47.17,
        y: 78.45,
        size: 133,
        imageSrc: "/rooms/bedroom/bedroom_rug.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_mirror",
        emoji: "🪞",
        label: "Зеркало",
        x: 63.07,
        y: 45.18,
        size: 32,
        imageSrc: "/rooms/bedroom/bedroom_mirror.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_painting",
        emoji: "🖼️",
        label: "Картина",
        x: 77.19,
        y: 37,
        size: 28,
        imageSrc: "/rooms/bedroom/bedroom_painting.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_bed",
        emoji: "🛏️",
        label: "Кровать",
        x: 69.22,
        y: 58.91,
        size: 94,
        imageSrc: "/rooms/bedroom/bedroom_bed.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_nightstand",
        emoji: "🗄️",
        label: "Тумбочка",
        x: 83.99,
        y: 65.27,
        size: 26,
        imageSrc: "/rooms/bedroom/bedroom_nightstand.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_lamp",
        emoji: "💡",
        label: "Лампа",
        x: 83.92,
        y: 56.45,
        size: 15,
        imageSrc: "/rooms/bedroom/bedroom_lamp.png",
      }),
      roomLayer("bedroom", {
        upgradeId: "bedroom_curtains",
        emoji: "🎀",
        label: "Шторы",
        x: 30.94,
        y: 39.91,
        size: 63,
        imageSrc: "/rooms/bedroom/bedroom_curtains.png",
      }),
    ],
  },
  {
    zoneId: "bathroom",
    bgColor: "#EFF6FF",
    bgEmoji: "🛁",
    bgImage: "/rooms/bathroom-bg.png",
    layers: [
      /* z: свет → … → коврик (первый в массиве — самый дальний; список относительно прошлой версии развёрнут) */
      roomLayer("bathroom", {
        upgradeId: "bathroom_light",
        emoji: "💡",
        label: "Свет",
        x: 69.3,
        y: 28.36,
        size: 24,
        imageSrc: "/rooms/bathroom/bathroom_light.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_mirror",
        emoji: "🪞",
        label: "Зеркало",
        x: 69.86,
        y: 36.36,
        size: 20,
        imageSrc: "/rooms/bathroom/bathroom_mirror.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_sink",
        emoji: "🚰",
        label: "Раковина",
        x: 68.56,
        y: 51.27,
        size: 32,
        imageSrc: "/rooms/bathroom/bathroom_sink.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_toilet",
        emoji: "🚽",
        label: "Туалет",
        x: 76.37,
        y: 56.73,
        size: 33,
        imageSrc: "/rooms/bathroom/bathroom_toilet.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_rack",
        emoji: "🧴",
        label: "Полка",
        x: 83.3,
        y: 63.27,
        size: 30,
        imageSrc: "/rooms/bathroom/bathroom_rack.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_bath",
        emoji: "🛁",
        label: "Ванна",
        x: 53.63,
        y: 41.09,
        size: 67,
        imageSrc: "/rooms/bathroom/bathroom_bath.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_plants",
        emoji: "🪴",
        label: "Растения",
        x: 40.98,
        y: 49.09,
        size: 28,
        imageSrc: "/rooms/bathroom/bathroom_plants.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_curtain",
        emoji: "🚿",
        label: "Занавески",
        x: 29.77,
        y: 40.18,
        size: 46,
        imageSrc: "/rooms/bathroom/bathroom_curtain.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_laundry_basket",
        emoji: "🧺",
        label: "Корзина для белья",
        x: 24.37,
        y: 63.09,
        size: 24,
        imageSrc: "/rooms/bathroom/bathroom_laundry_basket.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_washer",
        emoji: "🫧",
        label: "Стиральная машина",
        x: 17.03,
        y: 66,
        size: 37,
        imageSrc: "/rooms/bathroom/bathroom_washer.png",
      }),
      roomLayer("bathroom", {
        upgradeId: "bathroom_mat",
        emoji: "⬜",
        label: "Коврик",
        x: 50.41,
        y: 74.18,
        size: 81,
        imageSrc: "/rooms/bathroom/bathroom_mat.png",
      }),
    ],
  },
  {
    zoneId: "terrace",
    bgColor: "#F0FFF8",
    bgEmoji: "🌿",
    bgImage: "/rooms/terrace-bg.png",
    layers: [
      /* z: раньше в массиве = ниже. Кушетка → кормушка → столик → шезлонг → гриль → зонт → растения → стулья → стол */
      roomLayer("terrace", {
        upgradeId: "terrace_chaise",
        emoji: "🛋️",
        label: "Кушетка",
        x: 48.74,
        y: 43.64,
        size: 81,
        imageSrc: "/rooms/terrace/terrace_chaise.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_feeder",
        emoji: "🐦",
        label: "Кормушка",
        x: 83.4,
        y: 50.18,
        size: 25,
        imageSrc: "/rooms/terrace/terrace_feeder.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_side_table",
        emoji: "🫖",
        label: "Столик",
        x: 36.32,
        y: 52.18,
        size: 22,
        imageSrc: "/rooms/terrace/terrace_side_table.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_sunlounger",
        emoji: "🏖️",
        label: "Шезлонг",
        x: 73.4,
        y: 60.91,
        size: 56,
        imageSrc: "/rooms/terrace/terrace_sunlounger.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_bbq",
        emoji: "🔥",
        label: "Барбекю гриль",
        x: 28,
        y: 56,
        size: 26,
        imageSrc: "/rooms/terrace/terrace_bbq.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_umbrella",
        emoji: "☂️",
        label: "Зонт",
        x: 61.82,
        y: 53.63,
        size: 66,
        imageSrc: "/rooms/terrace/terrace_umbrella.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_plants",
        emoji: "🌺",
        label: "Растения",
        x: 20.42,
        y: 65.82,
        size: 41,
        imageSrc: "/rooms/terrace/terrace_plants.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_chairs",
        emoji: "🪑",
        label: "Стулья",
        x: 53.63,
        y: 65.27,
        size: 50,
        imageSrc: "/rooms/terrace/terrace_chairs.png",
      }),
      roomLayer("terrace", {
        upgradeId: "terrace_table",
        emoji: "🍽️",
        label: "Стол",
        x: 50.65,
        y: 75.09,
        size: 72,
        imageSrc: "/rooms/terrace/terrace_table.png",
      }),
    ],
  },
  {
    zoneId: "office",
    bgColor: "#F8FAFC",
    bgEmoji: "📚",
    bgImage: "/rooms/office-bg.png",
    layers: [
      roomLayer("office", { upgradeId: "office_rug", emoji: "🟫", label: "Ковёр", x: 49.42, y: 67.64, size: 156 }),
      roomLayer("office", { upgradeId: "office_cabinet", emoji: "🗄️", label: "Шкаф", x: 80.31, y: 52.18, size: 46 }),
      roomLayer("office", { upgradeId: "office_painting", emoji: "🖼️", label: "Картина", x: 68.7, y: 32.64, size: 38 }),
      roomLayer("office", { upgradeId: "office_clock", emoji: "🕒", label: "Часы", x: 56.02, y: 22, size: 18 }),
      roomLayer("office", { upgradeId: "office_desk", emoji: "📋", label: "Стол", x: 42.84, y: 60.27, size: 64 }),
      roomLayer("office", { upgradeId: "office_computer", emoji: "💻", label: "Компьютер", x: 43.74, y: 51.82, size: 32 }),
      roomLayer("office", { upgradeId: "office_globe", emoji: "🌍", label: "Глобус", x: 50.77, y: 39.82, size: 30 }),
      roomLayer("office", { upgradeId: "office_task_chair", emoji: "💺", label: "Кресло офисное", x: 52.72, y: 65.18, size: 31 }),
      roomLayer("office", { upgradeId: "office_sofa", emoji: "🛋️", label: "Диван", x: 64.24, y: 49.91, size: 71 }),
      roomLayer("office", { upgradeId: "office_coffee_table", emoji: "☕", label: "Кофейный столик", x: 25.66, y: 63, size: 30 }),
      roomLayer("office", { upgradeId: "office_chair", emoji: "🪑", label: "Кресло обычное", x: 18.51, y: 68.18, size: 40 }),
    ],
  },
  {
    zoneId: "lounge",
    bgColor: "#1E1528",
    bgEmoji: "🍷",
    bgImage: "/rooms/lounge-bg.png",
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
    bgImage: "/rooms/secret-bg.png",
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
    bgImage: "/rooms/garden-bg.png",
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
