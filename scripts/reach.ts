/** Какие цепочки игрок реально может получить: у цепочки должен быть генератор. */
import { ITEM_CHAINS, ALL_ITEMS, itemIsGenerator, itemIsMergeable } from "../src/types";
import { ZONE_TO_GENERATOR_ID } from "../src/roomMergeCatalog";

const spawnable = new Set(
  Object.values(ZONE_TO_GENERATOR_ID)
    .map((id) => ALL_ITEMS[id])
    .filter((d): d is any => d && itemIsGenerator(d))
    .map((d) => d.spawnsChainId)
);

for (const ch of Object.values(ITEM_CHAINS)) {
  const n = ch.items.filter(itemIsMergeable).length;
  const ok = spawnable.has(ch.id);
  console.log(`${ok ? "  ✓" : "  ✗"} ${ch.id.padEnd(18)} ${String(n).padStart(2)} предметов  ${ok ? "" : "← генератора нет"}`);
}
