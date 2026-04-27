/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Реплики персонажей на поле миниигры.
 * Использование: `getFieldLine("level_up")` или `getFieldLine("room_enter", "kitchen")`
 */

export type FieldTrigger =
  | "level_up"
  | "no_moves"
  | "session_complete"
  | "order_delivered"
  | "grey_merge_first"
  | "reconstruction_deliver"
  | "room_enter";

export type FieldNPC = "lena" | "tom";

export interface FieldLine {
  npc: FieldNPC;
  text: string;
}

const FIELD_LINES: Record<string, FieldLine[]> = {
  level_up: [
    { npc: "lena", text: "Растём! Бабушка бы порадовалась." },
    { npc: "lena", text: "Ещё один шаг к настоящему кафе." },
    { npc: "lena", text: "Хорошая работа. Продолжаем!" },
  ],
  no_moves: [
    {
      npc: "lena",
      text: "Хм… кажется, нужно переставить вещи. Попробуем с другой стороны?",
    },
  ],
  session_complete: [
    {
      npc: "lena",
      text: "Пять заказов! Гости довольны, я тоже. Продолжим или сделаем перерыв?",
    },
  ],
  order_delivered: [
    { npc: "lena", text: "Свежо и вовремя!" },
    { npc: "lena", text: "Гость будет доволен." },
    { npc: "lena", text: "Именно то, что просили." },
    { npc: "lena", text: "Бабушка делала это лучше, но мы учимся." },
  ],
  grey_merge_first: [
    {
      npc: "lena",
      text: "О! Под пылью что-то спрятано. Нужно подобрать ключ.",
    },
  ],
  reconstruction_deliver: [
    { npc: "tom", text: "То что надо! Я как раз возился с этим участком." },
    { npc: "tom", text: "Отлично! Поставлю сюда — будет почти как новое." },
    {
      npc: "tom",
      text: "Знаешь, у меня в гараже ещё кое-что есть… потом расскажу.",
    },
  ],
  room_enter_hall: [
    { npc: "lena", text: "Зал. Здесь бабушка встречала каждого гостя лично." },
  ],
  room_enter_kitchen: [
    {
      npc: "lena",
      text: "Кухня! Чувствую запах её пирогов. Нужно разобраться тут.",
    },
  ],
  room_enter_terrace: [
    { npc: "lena", text: "Терраса… Том уже посадил розы. Хорошее начало." },
  ],
  room_enter_lounge: [
    { npc: "lena", text: "Лаунж. Раньше тут играла живая музыка по пятницам." },
  ],
  room_enter_secret: [
    { npc: "lena", text: "Это место… я не знала, что оно существует." },
  ],
  room_enter_bedroom: [
    {
      npc: "lena",
      text: "Здесь она отдыхала между сменами. Пусть снова будет уютно.",
    },
  ],
  room_enter_garden: [
    { npc: "lena", text: "Сад! Нужно спросить Тома про клумбы." },
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function getFieldLine(
  trigger: FieldTrigger,
  zone?: string
): FieldLine | null {
  const key =
    trigger === "room_enter" && zone ? `room_enter_${zone}` : trigger;
  const pool = FIELD_LINES[key];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool);
}
