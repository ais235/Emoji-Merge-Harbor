/** Оценка длительности прохождения по текущему балансу. Запуск: npx tsx scripts/estimate.ts */
import { UPGRADES } from "../src/progressionData";
import { CHAIN_COMPLETE_REWARDS } from "../src/collection";
import { ITEM_CHAINS, itemIsMergeable } from "../src/types";
import { ENERGY_MAX_DEFAULT, ENERGY_REGEN_INTERVAL_MS, ENERGY_ORDER_COMPLETE_BONUS } from "../src/gameBalance";

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const vis = UPGRADES.filter((u) => u.effectType === "visual");
const meta = UPGRADES.filter((u) => u.effectType !== "visual");

console.log("=== КОНТЕНТ ===");
console.log(`мебель:            ${vis.length} шт · ${sum(vis.map((u) => u.cost))} монет`);
console.log(`мета-улучшения:    ${meta.length} шт · ${sum(meta.map((u) => u.cost))} монет`);
const totalCost = sum(UPGRADES.map((u) => u.cost));
console.log(`купить всё:        ${totalCost} монет`);

let xpTo30 = 0;
for (let L = 1; L < 30; L++) xpTo30 += 100 + L * 20;
console.log(`XP до 30 уровня:   ${xpTo30}`);

const chains = Object.values(ITEM_CHAINS);
const collectibles = sum(chains.map((c) => c.items.filter(itemIsMergeable).length));
console.log(`коллекция:         ${collectibles} предметов в ${chains.length} цепочках`);
console.log(`награды коллекции: ${sum(Object.values(CHAIN_COMPLETE_REWARDS).map((r) => r.coins))} монет`);

// --- средний заказ по текущим тирам и множителям ---
// simple 18-26 (÷2 xp), medium 45-65 (÷1.5), hard 105-145 (÷1)
// множители: simple ~1.0, medium ~1.8, hard ~2.8 (с учётом слотов и количеств)
const tiers = [
  { name: "simple", coins: 22, xp: 11, mult: 1.0, share: 0.35 },
  { name: "medium", coins: 55, xp: 36, mult: 1.8, share: 0.45 },
  { name: "hard", coins: 125, xp: 125, mult: 2.8, share: 0.2 },
];
const avgCoins = sum(tiers.map((t) => t.coins * t.mult * t.share));
const avgXp = sum(tiers.map((t) => t.xp * t.mult * t.share));
console.log("\n=== ЗАКАЗ В СРЕДНЕМ ===");
console.log(`монет: ${avgCoins.toFixed(0)} · опыта: ${avgXp.toFixed(0)}`);

// --- сколько заказов нужно ---
const ordersForXp = Math.ceil(xpTo30 / avgXp);
const ordersForCoins = Math.ceil(totalCost / avgCoins);
const ordersForField = 32 * 5; // зона 3: 32 клетки × 5 заказов
console.log("\n=== СКОЛЬКО ЗАКАЗОВ НУЖНО ===");
console.log(`на 30 уровень:     ${ordersForXp}`);
console.log(`на весь интерьер:  ${ordersForCoins}`);
console.log(`на всё поле:       ${ordersForField}`);
const orders = Math.max(ordersForXp, ordersForCoins, ordersForField);
console.log(`→ узкое место:     ${orders} заказов`);

// --- энергия ---
// на предмет уровня N нужно 2^(N-1) спавнов. средний заказ просит ~1.4 предмета ур. ~3
const spawnsPerOrder = 1.4 * 2 ** (3 - 1);
const totalSpawns = Math.round(orders * spawnsPerOrder);
const energyBack = orders * ENERGY_ORDER_COMPLETE_BONUS;
const netEnergy = totalSpawns - energyBack;
console.log("\n=== ЭНЕРГИЯ ===");
console.log(`спавнов на заказ:  ~${spawnsPerOrder.toFixed(1)}`);
console.log(`всего спавнов:     ~${totalSpawns}`);
console.log(`вернётся с заказов:${energyBack}`);
console.log(`чистый расход:     ~${netEnergy} энергии`);

const regenPerHour = 3600000 / ENERGY_REGEN_INTERVAL_MS;
const hoursOfRegen = netEnergy / regenPerHour;
console.log(`реген:             ${regenPerHour}/час`);
console.log(`часов регена:      ~${hoursOfRegen.toFixed(0)}`);

// --- сессии ---
const maxEnergy = ENERGY_MAX_DEFAULT + 30; // с купленными мета-апгрейдами
const spawnsPerSession = maxEnergy;
const sessions = Math.ceil(totalSpawns / spawnsPerSession);
console.log("\n=== СЕССИИ ===");
console.log(`потолок энергии:   ${maxEnergy} (с мета-апгрейдами)`);
console.log(`сессий по полной шкале: ~${sessions}`);
console.log(`шкала копится:     ${(maxEnergy / regenPerHour).toFixed(1)} ч`);
console.log(`→ при 1 сессии в день: ~${sessions} дней`);
console.log(`→ при 2 сессиях в день: ~${Math.ceil(sessions / 2)} дней`);

// --- чистое время за экраном ---
// ~4 сек на действие (тап генератора / мердж / сдача)
const actions = totalSpawns + totalSpawns * 0.9 + orders; // спавны + мерджи + сдачи
const activeHours = (actions * 3.5) / 3600;
console.log("\n=== ЧИСТОЕ ВРЕМЯ ЗА ЭКРАНОМ ===");
console.log(`действий:          ~${Math.round(actions)}`);
console.log(`при 3.5 с/действие: ~${activeHours.toFixed(1)} ч активной игры`);
