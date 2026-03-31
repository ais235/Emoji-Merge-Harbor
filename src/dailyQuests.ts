/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DAILY_QUEST_STORAGE_KEY = "dailyQuests";

export type DailyQuestsState = {
  date: string;
  progress: {
    dq_orders: number;
    dq_merges: number;
    dq_coins: number;
  };
  claimed: string[];
  weeklyProgress: number;
  weeklyClaimed: boolean;
  weekStart: string;
};

export const DAILY_QUESTS = [
  { id: "dq_orders", text: "Выполни 3 заказа", goal: 3, reward: 80, icon: "📦" },
  { id: "dq_merges", text: "Слей 10 предметов", goal: 10, reward: 60, icon: "✨" },
  { id: "dq_coins", text: "Заработай 100 монет", goal: 100, reward: 50, icon: "🍪" },
] as const;

export const WEEKLY_QUEST = {
  id: "wq_upgrades",
  text: "Купи 2 улучшения",
  goal: 2,
  reward: 500,
  icon: "🏠",
};

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + "T12:00:00").getTime();
  const b = new Date(endISO + "T12:00:00").getTime();
  return Math.floor((b - a) / 86400000);
}

export function createBlankDailyQuests(): DailyQuestsState {
  const t = todayKey();
  return {
    date: t,
    progress: { dq_orders: 0, dq_merges: 0, dq_coins: 0 },
    claimed: [],
    weeklyProgress: 0,
    weeklyClaimed: false,
    weekStart: t,
  };
}

/** Сброс дня / недели по правилам хранилища */
export function normalizeDailyQuestsState(data: DailyQuestsState): DailyQuestsState {
  const today = todayKey();
  let { date, progress, claimed, weeklyProgress, weeklyClaimed, weekStart } = data;

  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    weekStart = today;
  }

  const weekExpired = daysBetween(weekStart, today) >= 7;
  if (weekExpired) {
    weeklyProgress = 0;
    weeklyClaimed = false;
    weekStart = today;
  }

  if (date !== today) {
    progress = { dq_orders: 0, dq_merges: 0, dq_coins: 0 };
    claimed = [];
    date = today;
  }

  return {
    date,
    progress,
    claimed,
    weeklyProgress,
    weeklyClaimed,
    weekStart,
  };
}

export function loadDailyQuests(): DailyQuestsState {
  try {
    const raw = localStorage.getItem(DAILY_QUEST_STORAGE_KEY);
    if (!raw) return createBlankDailyQuests();
    const p = JSON.parse(raw) as Partial<DailyQuestsState>;
    if (!p || typeof p !== "object") return createBlankDailyQuests();
    const merged: DailyQuestsState = {
      date: typeof p.date === "string" ? p.date : todayKey(),
      progress: {
        dq_orders: typeof p.progress?.dq_orders === "number" ? p.progress.dq_orders : 0,
        dq_merges: typeof p.progress?.dq_merges === "number" ? p.progress.dq_merges : 0,
        dq_coins: typeof p.progress?.dq_coins === "number" ? p.progress.dq_coins : 0,
      },
      claimed: Array.isArray(p.claimed) ? p.claimed.filter((x): x is string => typeof x === "string") : [],
      weeklyProgress: typeof p.weeklyProgress === "number" ? p.weeklyProgress : 0,
      weeklyClaimed: Boolean(p.weeklyClaimed),
      weekStart: typeof p.weekStart === "string" ? p.weekStart : todayKey(),
    };
    return normalizeDailyQuestsState(merged);
  } catch {
    return createBlankDailyQuests();
  }
}

export function saveDailyQuests(data: DailyQuestsState): void {
  try {
    localStorage.setItem(DAILY_QUEST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export type QuestProgressType = "order" | "merge" | "coins" | "upgrade";

export function applyQuestProgress(
  data: DailyQuestsState,
  type: QuestProgressType,
  amount: number
): DailyQuestsState {
  const base = normalizeDailyQuestsState(data);
  if (type === "upgrade") {
    return {
      ...base,
      weeklyProgress: base.weeklyProgress + amount,
    };
  }
  const progress = { ...base.progress };
  if (type === "order") progress.dq_orders += amount;
  else if (type === "merge") progress.dq_merges += amount;
  else if (type === "coins") progress.dq_coins += amount;
  return { ...base, progress };
}

export type HomeQuestBannerSummary = {
  completed: number;
  total: number;
  unclaimedCount: number;
};

export function getHomeQuestSummary(d: DailyQuestsState): HomeQuestBannerSummary {
  const q = normalizeDailyQuestsState(d);
  let completed = 0;
  for (const task of DAILY_QUESTS) {
    const prog = q.progress[task.id as keyof typeof q.progress];
    if (prog >= task.goal) completed += 1;
  }
  let unclaimedCount = 0;
  for (const task of DAILY_QUESTS) {
    const prog = q.progress[task.id as keyof typeof q.progress];
    if (prog >= task.goal && !q.claimed.includes(task.id)) unclaimedCount += 1;
  }
  if (q.weeklyProgress >= WEEKLY_QUEST.goal && !q.weeklyClaimed) unclaimedCount += 1;
  return { completed, total: DAILY_QUESTS.length, unclaimedCount };
}

export function tryClaimDailyQuest(
  dq: DailyQuestsState,
  questId: string
): { next: DailyQuestsState; reward: number } | null {
  const q = normalizeDailyQuestsState(dq);
  const task = DAILY_QUESTS.find((t) => t.id === questId);
  if (!task || q.claimed.includes(questId)) return null;
  const prog = q.progress[task.id as keyof typeof q.progress];
  if (prog < task.goal) return null;
  return { next: { ...q, claimed: [...q.claimed, questId] }, reward: task.reward };
}

export function tryClaimWeekly(
  dq: DailyQuestsState
): { next: DailyQuestsState; reward: number } | null {
  const q = normalizeDailyQuestsState(dq);
  if (q.weeklyProgress < WEEKLY_QUEST.goal || q.weeklyClaimed) return null;
  return { next: { ...q, weeklyClaimed: true }, reward: WEEKLY_QUEST.reward };
}
