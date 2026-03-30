import { LEVELS, UPGRADES } from "./progressionData";
import { ProgressionState, Upgrade, LevelConfig } from "./types";

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

    while (currentXp >= this.getXpToNextLevel(currentLevel)) {
      currentXp -= this.getXpToNextLevel(currentLevel);
      currentLevel++;
      leveledUp = true;
      
      // Проверка открытия новых зон при повышении уровня
      const levelConfig = LEVELS.find(l => l.level === currentLevel);
      if (levelConfig && levelConfig.unlocks.length > 0) {
        levelConfig.unlocks.forEach(zone => {
          if (!this.state.unlockedZones.includes(zone)) {
            this.state.unlockedZones.push(zone);
          }
        });
      }
    }

    this.state = {
      ...this.state,
      level: currentLevel,
      xp: currentXp
    };

    return { leveledUp, newState: this.state };
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

  // Получение активных бонусов от улучшений
  public getActiveBonuses() {
    const bonuses = {
      energy_max: 0,
      gen_speed: 1.0,
      income_bonus: 1.0,
      bonus_chance: 0
    };

    this.state.purchasedUpgrades.forEach(id => {
      const upgrade = UPGRADES.find(u => u.id === id);
      if (upgrade) {
        if (upgrade.effectType === "energy_max") bonuses.energy_max += upgrade.effectValue;
        if (upgrade.effectType === "gen_speed") bonuses.gen_speed += upgrade.effectValue;
        if (upgrade.effectType === "income_bonus") bonuses.income_bonus += upgrade.effectValue;
        if (upgrade.effectType === "bonus_chance") bonuses.bonus_chance += upgrade.effectValue;
      }
    });

    return bonuses;
  }

  public getState(): ProgressionState {
    return this.state;
  }
}

export class EconomyManager {
  // Доход: простой (10-30), средний (30-80), сложный (80-200)
  public static calculateOrderReward(difficulty: "simple" | "medium" | "hard"): { coins: number; xp: number } {
    let coins = 0;
    let xp = 0;

    switch (difficulty) {
      case "simple":
        coins = Math.floor(Math.random() * 21) + 10;
        xp = Math.floor(coins / 2);
        break;
      case "medium":
        coins = Math.floor(Math.random() * 51) + 30;
        xp = Math.floor(coins / 1.5);
        break;
      case "hard":
        coins = Math.floor(Math.random() * 121) + 80;
        xp = coins;
        break;
    }

    return { coins, xp };
  }
}
