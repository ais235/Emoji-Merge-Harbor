import { LEVELS, UPGRADES } from "./progressionData";
import type { ProgressionState } from "./types";

/** Суммарные эффекты купленных апгрейдов. Все, кроме `energy_max`, — доли (0 = нет эффекта). */
export interface ActiveBonuses {
  /** Прибавка к потолку энергии (целое). */
  energy_max: number;
  /** Множитель монет за заказ: итог = round(base * (1 + income_bonus)). */
  income_bonus: number;
  /** Вероятность удвоить монеты за заказ (0..1). */
  bonus_chance: number;
  /** Вероятность бонусных монет при открытии ящика (0..1). */
  box_loot_chance: number;
  /** Вероятность не потратить энергию при спавне с генератора (0..1). */
  free_spawn_chance: number;
}

export class ProgressionManager {
  private state: ProgressionState;

  constructor(initialState: ProgressionState) {
    this.state = initialState;
  }

  // Формула опыта: XP = 100 + (уровень * 20)
  public getXpToNextLevel(level: number): number {
    return 100 + level * 20;
  }

  // Добавление опыта и проверка повышения уровня
  public addXp(amount: number): { leveledUp: boolean; newState: ProgressionState } {
    let currentXp = this.state.xp + amount;
    let currentLevel = this.state.level;
    let leveledUp = false;

    // Копия: массив из текущего состояния мутировать нельзя — это тот же объект,
    // что лежит в React-стейте, и по неизменившейся ссылке не сработают useEffect / useMemo.
    const unlockedZones = [...this.state.unlockedZones];

    while (currentXp >= this.getXpToNextLevel(currentLevel)) {
      currentXp -= this.getXpToNextLevel(currentLevel);
      currentLevel++;
      leveledUp = true;

      // Проверка открытия новых зон при повышении уровня
      const levelConfig = LEVELS.find((l) => l.level === currentLevel);
      if (levelConfig && levelConfig.unlocks.length > 0) {
        levelConfig.unlocks.forEach((zone) => {
          if (!unlockedZones.includes(zone)) {
            unlockedZones.push(zone);
          }
        });
      }
    }

    this.state = {
      ...this.state,
      level: currentLevel,
      xp: currentXp,
      // Новая ссылка только когда состав действительно изменился.
      unlockedZones:
        unlockedZones.length === this.state.unlockedZones.length ? this.state.unlockedZones : unlockedZones,
    };

    return { leveledUp, newState: this.state };
  }

  /** Начисление монет (заказы, квесты и т.д. — всегда через ProgressionManager). */
  public addCoins(amount: number): ProgressionState {
    this.state = {
      ...this.state,
      coins: this.state.coins + amount,
    };
    return this.state;
  }

  // Покупка улучшения
  public purchaseUpgrade(upgradeId: string): { success: boolean; newState: ProgressionState; error?: string } {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    
    if (!upgrade) return { success: false, newState: this.state, error: "Улучшение не найдено" };
    if (this.state.level < upgrade.requiredLevel) return { success: false, newState: this.state, error: "Недостаточный уровень" };
    if (this.state.coins < upgrade.cost) return { success: false, newState: this.state, error: "Недостаточно монет" };
    if (this.state.purchasedUpgrades.includes(upgradeId)) return { success: false, newState: this.state, error: "Уже куплено" };

    this.state = {
      ...this.state,
      coins: this.state.coins - upgrade.cost,
      purchasedUpgrades: [...this.state.purchasedUpgrades, upgradeId]
    };

    return { success: true, newState: this.state };
  }

  /** Суммирование effectValue по типам. Дефолт для всех — 0 (эффекта нет). */
  public getActiveBonuses(): ActiveBonuses {
    const bonuses: ActiveBonuses = {
      energy_max: 0,
      income_bonus: 0,
      bonus_chance: 0,
      box_loot_chance: 0,
      free_spawn_chance: 0,
    };

    this.state.purchasedUpgrades.forEach((id) => {
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (!upgrade || upgrade.effectType === "visual") return;
      bonuses[upgrade.effectType] += upgrade.effectValue;
    });

    bonuses.free_spawn_chance = Math.min(0.95, bonuses.free_spawn_chance);
    bonuses.box_loot_chance = Math.min(0.95, bonuses.box_loot_chance);
    bonuses.bonus_chance = Math.min(0.95, bonuses.bonus_chance);

    return bonuses;
  }

  public getState(): ProgressionState {
    return this.state;
  }
}

/**
 * Базовая награда за заказ по сложности: узкий разброс (±~18%) вокруг центра тира.
 * Раньше диапазоны были 10–30 / 30–80 / 80–200 — до 3× разницы между двумя заказами
 * одной и той же сложности, из-за чего ранняя экономика читалась как чистый рандом.
 */
const ORDER_REWARD_TIERS: Record<"simple" | "medium" | "hard", { min: number; max: number; xpDivisor: number }> = {
  simple: { min: 18, max: 26, xpDivisor: 2 },
  medium: { min: 45, max: 65, xpDivisor: 1.5 },
  hard: { min: 105, max: 145, xpDivisor: 1 },
};

export class EconomyManager {
  public static calculateOrderReward(difficulty: "simple" | "medium" | "hard"): { coins: number; xp: number } {
    const tier = ORDER_REWARD_TIERS[difficulty];
    const coins = tier.min + Math.floor(Math.random() * (tier.max - tier.min + 1));
    return { coins, xp: Math.max(1, Math.floor(coins / tier.xpDivisor)) };
  }
}
