/**
 * Быстрая проверка игровой логики без UI: `npx tsx scripts/smoke.ts`.
 * Покрывает то, что легко ломается молча: покрытие поля зонами, эффекты апгрейдов,
 * достижимость этапов реконструкции и генерацию заказов на старте.
 */
import assert from "node:assert/strict";

import { FIELD_ZONES } from "../src/utils/fieldZones";
import { buildInitialGrid } from "../src/utils/buildInitialGrid";
import { handleMergeFieldProgress, handleOrderFieldProgress } from "../src/utils/mergeFieldProgress";
import { ProgressionManager } from "../src/progressionManager";
import { HUB_ZONES, LEVELS, UPGRADES } from "../src/progressionData";
import { RECONSTRUCTION_STAGES } from "../src/reconstruction";
import {
  ALL_ITEMS,
  ITEM_CHAINS,
  itemIsGenerator,
  itemIsMergeable,
  progressZoneId,
  type ProgressionState,
} from "../src/types";
import { ZONE_TO_GENERATOR_ID } from "../src/roomMergeCatalog";
import {
  playerTierMaxOrderItemLevel,
  playerTierMinOrderItemLevel,
} from "../src/utils/sessionGridProgress";
import { BOX_BONUS_LOOT_COINS } from "../src/gameBalance";

const W = 9;
const H = 12;
let checks = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  checks += 1;
  console.log(`  ok  ${name}`);
};

ok("каждая клетка поля 9x12 принадлежит какой-то зоне открытия", () => {
  const cc = Math.floor(W / 2);
  const cr = Math.floor(H / 2);
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs((i % W) - cc) + Math.abs(Math.floor(i / W) - cr);
    const zone = FIELD_ZONES.find((z) => d >= z.distMin && d <= z.distMax);
    assert.ok(zone, `клетка ${i} (манхэттен ${d}) не покрыта ни одной зоной`);
  }
});

ok("стартовое поле: очереди открытия покрывают все запечатанные клетки", () => {
  const { grid, fieldProgress } = buildInitialGrid(W, H, "hall");
  const sealed = grid.filter((c) => c.cellType === "box" || c.cellType === "hint_box").length;
  const queued =
    fieldProgress.unlockQueues.zone_1.length +
    fieldProgress.unlockQueues.zone_2.length +
    fieldProgress.unlockQueues.zone_3.length;
  assert.equal(queued, sealed);
});

ok("зона 1 полностью открывается слияниями", () => {
  let { grid, fieldProgress } = buildInitialGrid(W, H, "hall");
  for (let i = 0; i < 400; i++) {
    const r = handleMergeFieldProgress(grid, fieldProgress, 2, W, H);
    grid = r.grid;
    fieldProgress = r.fieldProgress;
  }
  assert.equal(fieldProgress.unlockQueues.zone_1.every((i) => grid[i].cellType !== "box"), true);
});

ok("зоны 2 и 3 полностью открываются заказами", () => {
  let { grid, fieldProgress } = buildInitialGrid(W, H, "hall");
  for (let i = 0; i < 400; i++) {
    const r = handleOrderFieldProgress(grid, fieldProgress, W, H);
    grid = r.grid;
    fieldProgress = r.fieldProgress;
  }
  const stillSealed = grid.filter((c) => c.cellType === "box" || c.cellType === "hint_box");
  // остаются только клетки зоны 1 (она открывается слияниями)
  const cc = Math.floor(W / 2);
  const cr = Math.floor(H / 2);
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (c.cellType !== "box" && c.cellType !== "hint_box") continue;
    const d = Math.abs((i % W) - cc) + Math.abs(Math.floor(i / W) - cr);
    assert.ok(d <= 4, `клетка ${i} на дистанции ${d} не открылась заказами`);
  }
  assert.ok(stillSealed.length > 0);
});

ok("апгрейд box_loot_chance = 1 даёт бонусные монеты при открытии ящика", () => {
  let { grid, fieldProgress } = buildInitialGrid(W, H, "hall");
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const r = handleMergeFieldProgress(grid, fieldProgress, 2, W, H, 1);
    grid = r.grid;
    fieldProgress = r.fieldProgress;
    total += r.bonusLootCoins;
  }
  assert.ok(total >= BOX_BONUS_LOOT_COINS, `ожидались бонусные монеты, получено ${total}`);
});

ok("у каждого не-визуального апгрейда есть тип с реализованным эффектом", () => {
  const implemented = new Set(["energy_max", "income_bonus", "bonus_chance", "box_loot_chance", "free_spawn_chance"]);
  for (const u of UPGRADES) {
    if (u.effectType === "visual") continue;
    assert.ok(implemented.has(u.effectType), `${u.id}: эффект ${u.effectType} не реализован`);
    assert.ok(u.effectValue > 0, `${u.id}: нулевой effectValue`);
  }
});

ok("getActiveBonuses суммирует купленные апгрейды", () => {
  const income = UPGRADES.filter((u) => u.effectType === "income_bonus");
  assert.ok(income.length > 0, "в каталоге нет ни одного income_bonus");
  const prog = { purchasedUpgrades: income.map((u) => u.id) } as ProgressionState;
  const b = new ProgressionManager(prog).getActiveBonuses();
  const expected = income.reduce((s, u) => s + u.effectValue, 0);
  assert.ok(Math.abs(b.income_bonus - expected) < 1e-9);
});

ok("addXp не мутирует unlockedZones исходного состояния", () => {
  const zones = ["hall"];
  const prog = { level: 4, xp: 0, unlockedZones: zones } as ProgressionState;
  new ProgressionManager(prog).addXp(10_000);
  assert.deepEqual(zones, ["hall"], "исходный массив зон был изменён на месте");
});

ok("предметы этапов реконструкции достижимы: у их цепочек есть генератор", () => {
  const spawnable = new Set(
    Object.values(ZONE_TO_GENERATOR_ID)
      .map((id) => ALL_ITEMS[id])
      .filter((d) => d && itemIsGenerator(d))
      .map((d) => (d as { spawnsChainId: string }).spawnsChainId)
  );
  for (const stage of RECONSTRUCTION_STAGES) {
    if (stage.requirement.type !== "items") continue;
    for (const need of stage.requirement.needs) {
      const def = ALL_ITEMS[need.itemId];
      assert.ok(def && itemIsMergeable(def), `${need.itemId} нет в ALL_ITEMS`);
      assert.ok(
        spawnable.has((def as { chain: string }).chain),
        `${stage.id}: цепочка ${(def as { chain: string }).chain} не производится ни одним генератором`
      );
    }
  }
});

ok("у каждой цепочки уровни идут подряд с 1 (иначе слияние упрётся в дыру)", () => {
  for (const chain of Object.values(ITEM_CHAINS)) {
    const levels = chain.items.filter(itemIsMergeable).map((i) => i.level).sort((a, b) => a - b);
    if (levels.length === 0) continue;
    levels.forEach((lv, i) => {
      assert.equal(lv, i + 1, `цепочка ${chain.id}: уровень ${lv} на позиции ${i}`);
    });
  }
});

ok("окно уровней заказов всегда шире одного уровня", () => {
  for (let lvl = 1; lvl <= 30; lvl++) {
    const min = playerTierMinOrderItemLevel(lvl);
    const max = playerTierMaxOrderItemLevel(lvl);
    assert.ok(max > min, `уровень ${lvl}: окно ${min}..${max} схлопнулось в одну ступень`);
  }
});

ok("в окне заказов на любом уровне минимум 2 разных предмета цепочки", () => {
  const chain = ITEM_CHAINS.hall_tea;
  for (let lvl = 1; lvl <= 20; lvl++) {
    const min = playerTierMinOrderItemLevel(lvl);
    const max = playerTierMaxOrderItemLevel(lvl);
    const inWindow = chain.items.filter(itemIsMergeable).filter((i) => i.level >= min && i.level <= max);
    assert.ok(inWindow.length >= 2, `уровень ${lvl}: в окне ${min}..${max} только ${inWindow.length} предмет(ов)`);
  }
});

ok("уровни открытия комнат совпадают в HUB_ZONES и в прогрессии", () => {
  for (const z of HUB_ZONES) {
    const cfg = LEVELS.find((l) => l.unlocks.includes(progressZoneId(z.id)));
    assert.ok(cfg, `${z.id}: нет записи в UNLOCKS_BY_LEVEL`);
    assert.equal(cfg.level, z.unlockLevel, `${z.id}: HUB_ZONES ${z.unlockLevel} ≠ LEVELS ${cfg.level}`);
  }
});

ok("мебель нельзя купить раньше, чем откроется её комната", () => {
  for (const z of HUB_ZONES) {
    const pid = progressZoneId(z.id);
    for (const u of UPGRADES) {
      if (u.effectType !== "visual" || u.zone !== pid) continue;
      assert.ok(
        u.requiredLevel >= z.unlockLevel,
        `${u.id}: требует ур. ${u.requiredLevel}, а комната открывается на ${z.unlockLevel}`
      );
    }
  }
});

ok("кривая уровней покрывает все открытия комнат", () => {
  const maxUnlock = Math.max(...HUB_ZONES.map((z) => z.unlockLevel));
  assert.ok(LEVELS.length >= maxUnlock, `LEVELS до ${LEVELS.length}, а сад открывается на ${maxUnlock}`);
});

ok("каждая цепочка коллекции достижима: у неё есть генератор", () => {
  const spawnable = new Set(
    Object.values(ZONE_TO_GENERATOR_ID)
      .map((id) => ALL_ITEMS[id])
      .filter((d) => d && itemIsGenerator(d))
      .map((d) => (d as { spawnsChainId: string }).spawnsChainId)
  );
  for (const ch of Object.values(ITEM_CHAINS)) {
    if (ch.items.filter(itemIsMergeable).length === 0) continue;
    assert.ok(spawnable.has(ch.id), `цепочка ${ch.id} есть в коллекции, но её никто не спавнит`);
  }
});

console.log(`\n${checks} проверок пройдено`);
