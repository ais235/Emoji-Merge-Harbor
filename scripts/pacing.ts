/**
 * Симуляция прохождения заказ за заказом по текущему балансу.
 * Учитывает рост сложности заказов по уровню и купленные income-апгрейды.
 * Запуск: npx tsx scripts/pacing.ts
 */
import { UPGRADES, HUB_ZONES } from "../src/progressionData";
import { progressZoneId } from "../src/types";

const xpToNext = (lvl: number) => 100 + lvl * 20;

/** Доли сложности по уровню — из pickOrderComplexity в App.tsx. */
function complexityMix(lvl: number): [number, number, number] {
  if (lvl < 5) return [0.75, 0.25, 0];
  if (lvl < 10) return [0.55, 0.40, 0.05];
  if (lvl < 15) return [0.35, 0.50, 0.15];
  return [0.20, 0.50, 0.30];
}

/** Средняя награда: база тира × множитель за слоты/количество. */
const TIER = { simple: { c: 22, x: 11, m: 1.0 }, medium: { c: 55, x: 36, m: 1.8 }, hard: { c: 125, x: 125, m: 2.8 } };

function orderReward(lvl: number, incomeBonus: number) {
  const [s, m, h] = complexityMix(lvl);
  const coins = (TIER.simple.c * TIER.simple.m * s + TIER.medium.c * TIER.medium.m * m + TIER.hard.c * TIER.hard.m * h);
  const xp = (TIER.simple.x * TIER.simple.m * s + TIER.medium.x * TIER.medium.m * m + TIER.hard.x * TIER.hard.m * h);
  return { coins: coins * (1 + incomeBonus), xp };
}

// очередь покупок: мебель по комнатам в порядке хаба, мета — по мере доступности
const rooms = HUB_ZONES.map((z) => ({
  zone: z,
  items: UPGRADES.filter((u) => u.effectType === "visual" && u.zone === progressZoneId(z.id)).sort((a, b) => a.cost - b.cost),
}));
const metaQueue = UPGRADES.filter((u) => u.effectType !== "visual").sort((a, b) => a.requiredLevel - b.requiredLevel || a.cost - b.cost);

let coins = 0, xp = 0, lvl = 1, orders = 0, incomeBonus = 0;
const bought = new Set<string>();
const log: { room: string; atOrder: number; atLevel: number; span: number }[] = [];
let roomStart = 0;

for (const r of rooms) {
  roomStart = orders;
  let remaining = [...r.items];
  let guard = 0;
  while (remaining.length > 0 && guard < 5000) {
    guard++;
    // мета-апгрейды покупаем, как только доступны (игрок так и делает — они усиливают доход)
    for (const u of metaQueue) {
      if (bought.has(u.id) || lvl < u.requiredLevel || coins < u.cost) continue;
      coins -= u.cost; bought.add(u.id);
      if (u.effectType === "income_bonus") incomeBonus += u.effectValue;
    }
    const next = remaining[0];
    if (coins >= next.cost && lvl >= next.requiredLevel) {
      coins -= next.cost; bought.add(next.id); remaining.shift();
      continue;
    }
    const rw = orderReward(lvl, incomeBonus);
    coins += rw.coins; xp += rw.xp; orders++;
    while (xp >= xpToNext(lvl)) { xp -= xpToNext(lvl); lvl++; }
  }
  log.push({ room: r.zone.displayName, atOrder: roomStart, atLevel: lvl, span: orders - roomStart });
}

console.log("комната          старт(заказ)  длина(заказов)  уровень в конце");
for (const e of log) {
  console.log(`${e.room.padEnd(17)}${String(e.atOrder).padStart(9)}${String(e.span).padStart(15)}${String(e.atLevel).padStart(17)}`);
}
console.log(`\nВСЕГО: ${orders} заказов, финальный уровень ${lvl}`);
console.log(`Мета-апгрейдов куплено: ${metaQueue.filter((u) => bought.has(u.id)).length}/${metaQueue.length}`);

console.log("\n=== доход за заказ по уровням ===");
for (const L of [1, 5, 10, 15, 20, 30]) {
  const r = orderReward(L, L >= 13 ? 0.45 : L >= 8 ? 0.25 : L >= 3 ? 0.1 : 0);
  console.log(`ур. ${String(L).padStart(2)}: ${r.coins.toFixed(0).padStart(4)} монет · ${r.xp.toFixed(0).padStart(3)} XP`);
}
