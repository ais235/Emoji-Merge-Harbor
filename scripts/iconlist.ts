import { ITEM_CHAINS, ALL_ITEMS, itemIsMergeable, COIN_PICKUP_ITEM_ID, ENERGY_PICKUP_ITEM_ID } from "../src/types";
import { ROOM_GENERATOR_DEFS } from "../src/roomMergeCatalog";
let n = 0;
for (const ch of Object.values(ITEM_CHAINS)) {
  const items = ch.items.filter(itemIsMergeable);
  n += items.length;
  console.log(`\n${ch.id} — ${ch.name} (${items.length})`);
  for (const it of items) console.log(`  ${it.id.padEnd(5)} ур.${it.level}  ${it.emoji}  ${it.name}`);
}
console.log(`\nГЕНЕРАТОРЫ (${Object.keys(ROOM_GENERATOR_DEFS).length})`);
for (const g of Object.values(ROOM_GENERATOR_DEFS)) console.log(`  ${g.id.padEnd(12)} ${g.emoji}  ${g.name}`);
n += Object.keys(ROOM_GENERATOR_DEFS).length;
console.log(`\nРЕСУРСЫ (2)`);
for (const id of [COIN_PICKUP_ITEM_ID, ENERGY_PICKUP_ITEM_ID]) { const d = ALL_ITEMS[id]; console.log(`  ${id.padEnd(12)} ${d.emoji}  ${d.name}`); }
console.log(`\nВСЕГО ИКОНОК: ${n + 2}`);
