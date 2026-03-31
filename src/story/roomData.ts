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
};

export type RoomVisual = {
  zoneId: string;
  bgColor: string;
  bgEmoji: string;
  layers: FurnitureLayer[];
};

/**
 * upgradeId совпадают с progressionData.ts (UPGRADES).
 * Визуальных слоёв столько, сколько реальных апгрейдов в зоне.
 */
export const ROOM_VISUALS: RoomVisual[] = [
  {
    zoneId: "hall",
    bgColor: "#FFF8F0",
    bgEmoji: "🏠",
    layers: [
      { upgradeId: "chair_fix", emoji: "🪑", label: "Стул", x: 12, y: 50, size: 34 },
      { upgradeId: "table_fix", emoji: "🍽️", label: "Стол", x: 55, y: 55, size: 38 },
    ],
  },
  {
    zoneId: "kitchen",
    bgColor: "#F0FFF4",
    bgEmoji: "🍳",
    layers: [
      { upgradeId: "kitchen_stove", emoji: "🍳", label: "Плита", x: 18, y: 52, size: 40 },
      { upgradeId: "kitchen_shelves", emoji: "🗄️", label: "Полки", x: 52, y: 58, size: 36 },
    ],
  },
  {
    zoneId: "terrace",
    bgColor: "#F0FFF8",
    bgEmoji: "🌿",
    layers: [
      { upgradeId: "terrace_umbrella", emoji: "☂️", label: "Зонт", x: 18, y: 52, size: 46 },
    ],
  },
  {
    zoneId: "secret",
    bgColor: "#F5F0FF",
    bgEmoji: "🔮",
    layers: [
      { upgradeId: "secret_safe", emoji: "🗝️", label: "Сейф", x: 18, y: 55, size: 44 },
    ],
  },
];

export function getRoomVisual(zone: ActiveZone): RoomVisual | undefined {
  return ROOM_VISUALS.find((r) => r.zoneId === zone);
}
