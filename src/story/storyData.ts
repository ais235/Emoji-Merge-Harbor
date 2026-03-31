/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ActiveZone } from "../types";

export type StoryCondition =
  | { type: "level"; value: number }
  | { type: "zone_unlocked"; zone: ActiveZone }
  | { type: "upgrade_bought"; upgradeId: string }
  | { type: "orders_completed"; count: number };

export type StoryChoice = {
  label: string;
  nextBeatId: string | null;
};

export type StoryBeat = {
  id: string;
  condition: StoryCondition;
  npc: "lena" | "tom" | "guest";
  text: string;
  choices: [StoryChoice, StoryChoice];
  shownOnce: boolean;
  /** Не подставлять в автоматическую очередь — только через выбор nextBeatId */
  chainOnly?: boolean;
};

/** Сюжетный id «chair» = апгрейд chair_fix в прогрессии. */
export const STORY_BEATS: StoryBeat[] = [
  {
    id: "start",
    condition: { type: "level", value: 1 },
    npc: "lena",
    text: "Наконец-то! Это кафе моей бабушки. Немного запущено, но я справлюсь. Начнём?",
    choices: [
      { label: "Да, давай!", nextBeatId: null },
      { label: "Расскажи о кафе", nextBeatId: "start_b" },
    ],
    shownOnce: true,
  },
  {
    id: "start_b",
    condition: { type: "level", value: 1 },
    npc: "lena",
    text: "Бабушка открыла это место 30 лет назад. Говорила — главное тепло, не деньги.",
    choices: [
      { label: "Красивая история", nextBeatId: null },
      { label: "Хватит, за работу!", nextBeatId: null },
    ],
    shownOnce: true,
    chainOnly: true,
  },
  {
    id: "first_order",
    condition: { type: "orders_completed", count: 1 },
    npc: "lena",
    text: "Первый гость! Он сказал, что приведёт друзей. Кажется, дело пошло!",
    choices: [
      { label: "Отлично!", nextBeatId: null },
      { label: "Главное не спешить", nextBeatId: null },
    ],
    shownOnce: true,
  },
  {
    id: "first_upgrade",
    condition: { type: "upgrade_bought", upgradeId: "chair" },
    npc: "tom",
    text: "Слышал, ты обновляешь место! Если что — у меня в гараже полно старых вещей.",
    choices: [
      { label: "Спасибо, Том!", nextBeatId: null },
      { label: "Что именно есть?", nextBeatId: "tom_garage" },
    ],
    shownOnce: true,
  },
  {
    id: "tom_garage",
    condition: { type: "level", value: 1 },
    npc: "tom",
    text: "Старый диван, пара стульев, какая-то картина. Всё твоё, если починишь.",
    choices: [
      { label: "Договорились!", nextBeatId: null },
      { label: "Посмотрим...", nextBeatId: null },
    ],
    shownOnce: true,
    chainOnly: true,
  },
  {
    id: "kitchen_unlock",
    condition: { type: "zone_unlocked", zone: "kitchen" },
    npc: "lena",
    text: "Бабушка оставила записную книжку с рецептами. Кухня пахнет её пирогами!",
    choices: [
      { label: "Открыть книжку", nextBeatId: null },
      { label: "Сначала плиту", nextBeatId: null },
    ],
    shownOnce: true,
  },
  {
    id: "guest_first",
    condition: { type: "level", value: 7 },
    npc: "guest",
    text: "Хорошее место. Оно было другим раньше. Не беспокойся — я просто прохожу мимо.",
    choices: [
      { label: "Кто вы?", nextBeatId: "guest_mystery" },
      { label: "Заходите ещё", nextBeatId: null },
    ],
    shownOnce: true,
  },
  {
    id: "guest_mystery",
    condition: { type: "level", value: 7 },
    npc: "guest",
    text: "Кто я? Просто старая знакомая. Твоя бабушка бы порадовалась тебе.",
    choices: [
      { label: "Вы знали её?", nextBeatId: null },
      { label: "До свидания...", nextBeatId: null },
    ],
    shownOnce: true,
    chainOnly: true,
  },
  {
    id: "terrace_unlock",
    condition: { type: "zone_unlocked", zone: "terrace" },
    npc: "tom",
    text: "Я посадил розы вдоль забора! Хотел сюрприз. Можно буду сидеть здесь иногда?",
    choices: [
      { label: "Конечно, Том!", nextBeatId: null },
      { label: "Только не каждый день", nextBeatId: null },
    ],
    shownOnce: true,
  },
  {
    id: "guest_hint",
    condition: { type: "level", value: 12 },
    npc: "guest",
    text: "Я знала твою бабушку. Она просила кое-что сохранить. Загляни в подвал, когда будешь готова.",
    choices: [
      { label: "В подвал?!", nextBeatId: null },
      { label: "Расскажите больше", nextBeatId: null },
    ],
    shownOnce: true,
  },
];
