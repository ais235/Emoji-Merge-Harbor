/** Параметры энергии и наград (баланс миниигры). */

/**
 * Потолок энергии. Замер: при 30 сессия длилась ~2,4 минуты — вдвое короче жанровой нормы
 * (Gossip Harbor ~4,5 мин при потолке 100). База 60 + 40 из мета-апгрейдов = 100.
 */
export const ENERGY_MAX_DEFAULT = 60;
/** +1 энергии не чаще чем раз в этот интервал (мс). Жанровая норма — 1 за 2–3 минуты. */
export const ENERGY_REGEN_INTERVAL_MS = 2 * 60 * 1000;
export const ENERGY_ORDER_COMPLETE_BONUS = 2;
export const ENERGY_AD_REWARD = 15;
export const COINS_AD_REWARD = 60;
export const COINS_AD_COOLDOWN_MS = 2 * 60 * 1000;
export const ENERGY_COIN_PACK_COST = 50;
export const ENERGY_COIN_PACK_AMOUNT = 10;

/** Бонусные монеты за удачный ролл `box_loot_chance` при открытии ящика. */
export const BOX_BONUS_LOOT_COINS = 25;

/** Кулдаун награды «реклама → энергия» (как у монетной рекламы). */
export const ENERGY_AD_COOLDOWN_MS = 3 * 60 * 1000;
