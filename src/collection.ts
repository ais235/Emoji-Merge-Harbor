import type { GridCell, ItemChain, ItemId, ProgressionState } from "./types";
import { ALL_ITEMS, ITEM_CHAINS } from "./types";
import { HUB_ZONES } from "./progressionData";
import { ZONE_TO_MERGE_CHAIN_ID } from "./roomMergeCatalog";
import { computeMaxSeenMergeableLevelFromGrid } from "./utils/sessionGridProgress";

/** Порядок секций коллекции — как список комнат на хабе «Дом», затем остальные цепочки (fruit, sweets, …). */
export function collectionChainsInHubOrder(): ItemChain[] {
  const seen = new Set<string>();
  const ordered: ItemChain[] = [];
  for (const zone of HUB_ZONES) {
    const chainId = ZONE_TO_MERGE_CHAIN_ID[zone.id];
    const ch = ITEM_CHAINS[chainId];
    if (ch) {
      ordered.push(ch);
      seen.add(chainId);
    }
  }
  for (const id of Object.keys(ITEM_CHAINS)) {
    if (seen.has(id)) continue;
    const ch = ITEM_CHAINS[id];
    if (ch) ordered.push(ch);
  }
  return ordered;
}

/** Награда за полный сбор цепочки (из `ITEM_CHAINS`). Ориентир — порядок цен мебели в комнате. */
export const CHAIN_COMPLETE_REWARDS: Record<string, { coins: number; energy: number }> = {
  fruit: { coins: 140, energy: 10 },
  sweets: { coins: 140, energy: 10 },
  hall_tea: { coins: 180, energy: 10 },
  kitchen_meal: { coins: 260, energy: 12 },
  bedroom_cozy: { coins: 340, energy: 14 },
  bathroom_fresh: { coins: 420, energy: 14 },
  terrace_plants: { coins: 620, energy: 16 },
  office_work: { coins: 780, energy: 18 },
  lounge_drinks: { coins: 920, energy: 20 },
  secret_mystic: { coins: 1200, energy: 22 },
  garden_harvest: { coins: 1500, energy: 24 },
};

/** Предметы из цепочек коллекции (фрукты, сладости, ключи — не генераторы/ресурсы). */
export const COLLECTIBLE_ITEM_IDS: ReadonlySet<string> = new Set(
  Object.values(ITEM_CHAINS).flatMap((c) => c.items.map((i) => i.id))
);

export function isCollectibleItemId(itemId: ItemId): boolean {
  return COLLECTIBLE_ITEM_IDS.has(itemId);
}

export function defaultCollectionState(): Pick<
  ProgressionState,
  "collectedItems" | "collectionChainRewardsClaimed"
> {
  return { collectedItems: {}, collectionChainRewardsClaimed: {} };
}

export function normalizeCollectionFields(prog: ProgressionState): ProgressionState {
  const ci = prog.collectedItems;
  const cr = prog.collectionChainRewardsClaimed;
  const toc = prog.totalOrdersCompleted;
  const msl = prog.maxSeenItemLevel;
  const mor = prog.minigameOrdersAtRoomRepair;
  return {
    ...prog,
    maxSeenItemLevel:
      typeof msl === "number" && Number.isFinite(msl) && msl >= 1 ? Math.floor(msl) : 1,
    minigameOrdersAtRoomRepair:
      mor && typeof mor === "object" && !Array.isArray(mor)
        ? (mor as ProgressionState["minigameOrdersAtRoomRepair"])
        : {},
    totalOrdersCompleted: typeof toc === "number" && Number.isFinite(toc) ? Math.max(0, Math.floor(toc)) : 0,
    collectedItems:
      ci && typeof ci === "object" && !Array.isArray(ci)
        ? (ci as Record<ItemId, boolean>)
        : {},
    collectionChainRewardsClaimed:
      cr && typeof cr === "object" && !Array.isArray(cr)
        ? (cr as Record<string, boolean>)
        : {},
  };
}

/**
 * Если все предметы цепочки в коллекции и награда ещё не забрана — начисляет монеты,
 * помечает цепочку полученной. Энергию возвращает отдельно (хранится в GameState).
 */
export function checkCollectionRewards(
  prog: ProgressionState,
  chainId: string
): {
  nextProg: ProgressionState;
  reward?: { coins: number; energy: number; chainId: string };
} {
  const chain = ITEM_CHAINS[chainId];
  if (!chain) return { nextProg: prog };

  const claimed = prog.collectionChainRewardsClaimed[chainId] === true;
  if (claimed) return { nextProg: prog };

  const allDone = chain.items.every((def) => prog.collectedItems[def.id] === true);
  if (!allDone) return { nextProg: prog };

  const pack = CHAIN_COMPLETE_REWARDS[chainId];
  if (!pack) return { nextProg: prog };

  return {
    nextProg: {
      ...prog,
      coins: prog.coins + pack.coins,
      collectionChainRewardsClaimed: {
        ...prog.collectionChainRewardsClaimed,
        [chainId]: true,
      },
    },
    reward: { coins: pack.coins, energy: pack.energy, chainId },
  };
}

export type CollectibleRegisterResult = {
  nextProg: ProgressionState;
  firstTime: boolean;
  storyText?: string;
  chainCompletion?: { chainId: string; chainName: string; coins: number; energy: number };
};

/** Одно новое получение предмета с поля (квест цепочки и тост). */
export function registerCollectibleObtained(
  prog: ProgressionState,
  itemId: ItemId
): CollectibleRegisterResult {
  if (!isCollectibleItemId(itemId)) {
    return { nextProg: prog, firstTime: false };
  }

  if (prog.collectedItems[itemId]) {
    return { nextProg: prog, firstTime: false };
  }

  const def = ALL_ITEMS[itemId];
  const storyText =
    def && "description" in def && typeof def.description === "string" ? def.description : undefined;

  let nextProg: ProgressionState = {
    ...prog,
    collectedItems: { ...prog.collectedItems, [itemId]: true },
  };

  const chainId = def && "level" in def ? def.chain : undefined;
  let chainCompletion: CollectibleRegisterResult["chainCompletion"];

  if (chainId && ITEM_CHAINS[chainId]) {
    const { nextProg: after, reward } = checkCollectionRewards(nextProg, chainId);
    nextProg = after;
    if (reward) {
      const ch = ITEM_CHAINS[chainId];
      chainCompletion = {
        chainId,
        chainName: ch?.name ?? chainId,
        coins: reward.coins,
        energy: reward.energy,
      };
    }
  }

  return {
    nextProg,
    firstTime: true,
    storyText,
    chainCompletion,
  };
}

/** Несколько id за один кадр (например несколько лут-клеток). */
export function registerCollectiblesBulk(
  prog: ProgressionState,
  itemIds: ItemId[]
): {
  nextProg: ProgressionState;
  firstStoryText?: string;
  lastChainCompletion?: CollectibleRegisterResult["chainCompletion"];
  totalEnergyFromChains: number;
} {
  let p = prog;
  let firstStoryText: string | undefined;
  let lastChain: CollectibleRegisterResult["chainCompletion"];
  let totalEnergyFromChains = 0;

  for (const id of itemIds) {
    const r = registerCollectibleObtained(p, id);
    p = r.nextProg;
    if (r.firstTime && r.storyText && firstStoryText === undefined) firstStoryText = r.storyText;
    if (r.chainCompletion) {
      lastChain = r.chainCompletion;
      totalEnergyFromChains += r.chainCompletion.energy;
    }
  }

  return { nextProg: p, firstStoryText, lastChainCompletion: lastChain, totalEnergyFromChains };
}

/** Синхронизация сетки при загрузке: отметить всё на поле, при полных цепочках выдать награды. */
export function hydrateCollectionFromGrid(
  grid: GridCell[],
  prog: ProgressionState
): { nextProg: ProgressionState; energyFromChainRewards: number } {
  let nextProg = normalizeCollectionFields(prog);
  const fromGridLevel = computeMaxSeenMergeableLevelFromGrid(grid);
  nextProg = {
    ...nextProg,
    maxSeenItemLevel: Math.max(nextProg.maxSeenItemLevel, fromGridLevel),
  };
  const idsOnGrid = new Set<ItemId>();
  for (const c of grid) {
    if (c.item && isCollectibleItemId(c.item)) idsOnGrid.add(c.item);
  }
  if (idsOnGrid.size === 0) return { nextProg, energyFromChainRewards: 0 };

  const mergedCollected = { ...nextProg.collectedItems };
  for (const id of idsOnGrid) mergedCollected[id] = true;
  nextProg = { ...nextProg, collectedItems: mergedCollected };

  let energyFromChainRewards = 0;
  for (const chainId of Object.keys(ITEM_CHAINS)) {
    const { nextProg: np, reward } = checkCollectionRewards(nextProg, chainId);
    nextProg = np;
    if (reward) energyFromChainRewards += reward.energy;
  }

  return { nextProg, energyFromChainRewards };
}
