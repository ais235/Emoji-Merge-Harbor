/** Длина одной сессии: от входа на поле до «энергия кончилась». */
import { ENERGY_REGEN_INTERVAL_MS, ENERGY_ORDER_COMPLETE_BONUS } from "../src/gameBalance";

/** Сколько спавнов нужно на один предмет уровня N (бинарное дерево слияний). */
const spawnsFor = (lvl: number) => 2 ** (lvl - 1);

/** Секунды на действие: тап по генератору ~1с, драг-слияние ~2с, сдача ~1.5с. */
const T_SPAWN = 1.0, T_MERGE = 2.0, T_DELIVER = 1.5;

function session(cap: number, avgItemLevel: number, itemsPerOrder: number) {
  const spawnsPerOrder = itemsPerOrder * spawnsFor(avgItemLevel);
  const mergesPerOrder = spawnsPerOrder - itemsPerOrder;
  // энергия: каждый спавн -1, каждый заказ +ENERGY_ORDER_COMPLETE_BONUS
  const netPerOrder = spawnsPerOrder - ENERGY_ORDER_COMPLETE_BONUS;
  const orders = cap / netPerOrder;
  const spawns = orders * spawnsPerOrder;
  const merges = orders * mergesPerOrder;
  const sec = spawns * T_SPAWN + merges * T_MERGE + orders * T_DELIVER;
  return { orders, spawns, merges, min: sec / 60 };
}

const regenPerHour = 3600000 / ENERGY_REGEN_INTERVAL_MS;

console.log("=== СЕЙЧАС (база 30, реген 1/3мин) ===");
for (const [cap, label] of [[30, "старт, без мета"], [60, "с мета-апгрейдами"]] as const) {
  for (const [lvl, ipo, when] of [[2, 1.2, "ранняя игра"], [3, 1.4, "середина"], [4, 1.6, "поздняя"]] as const) {
    const s = session(cap, lvl, ipo);
    console.log(
      `${label.padEnd(20)}${when.padEnd(14)}` +
      `${s.orders.toFixed(1).padStart(5)} заказов  ${s.min.toFixed(1).padStart(5)} мин  ` +
      `восстановление ${(cap / regenPerHour).toFixed(1)} ч`
    );
  }
}

console.log("\n=== ПРЕДЛОЖЕНИЕ (база 50, реген 1/90с) ===");
const regen2 = 3600000 / 90000;
for (const [cap, label] of [[50, "старт, без мета"], [80, "с мета-апгрейдами"]] as const) {
  for (const [lvl, ipo, when] of [[2, 1.2, "ранняя игра"], [3, 1.4, "середина"], [4, 1.6, "поздняя"]] as const) {
    const s = session(cap, lvl, ipo);
    console.log(
      `${label.padEnd(20)}${when.padEnd(14)}` +
      `${s.orders.toFixed(1).padStart(5)} заказов  ${s.min.toFixed(1).padStart(5)} мин  ` +
      `восстановление ${(cap / regen2).toFixed(1)} ч`
    );
  }
}

console.log("\n=== СКОЛЬКО ВСЕГО СЕССИЙ ===");
const TOTAL_ORDERS = 423;
for (const [cap, label] of [[30, "сейчас (30)"], [60, "база 60"], [100, "с мета (100)"]] as const) {
  const s = session(cap, 3, 1.4);
  console.log(`${label.padEnd(26)}${Math.ceil(TOTAL_ORDERS / s.orders)} сессий по ~${s.min.toFixed(0)} мин`);
}
