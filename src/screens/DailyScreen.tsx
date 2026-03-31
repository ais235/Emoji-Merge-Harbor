/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { DAILY_REWARDS } from "../components/DailyBonusModal";
import {
  DAILY_QUESTS,
  WEEKLY_QUEST,
  type DailyQuestsState,
  normalizeDailyQuestsState,
} from "../dailyQuests";

const LAST_DAILY_BONUS_KEY = "lastDailyBonus";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface DailyScreenProps {
  dailyQuests: DailyQuestsState;
  streakDay: number;
  onBack: () => void;
  onClaimDailyBonus: (coins: number, energy: number) => void;
  onClaimDailyQuest: (questId: string) => void;
  onClaimWeekly: () => void;
}

export default function DailyScreen({
  dailyQuests,
  streakDay,
  onBack,
  onClaimDailyBonus,
  onClaimDailyQuest,
  onClaimWeekly,
}: DailyScreenProps) {
  const quests = normalizeDailyQuestsState(dailyQuests);
  const safeStreak = Math.min(7, Math.max(1, streakDay));
  const rewardToday = DAILY_REWARDS[safeStreak];

  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const lastRaw = typeof localStorage !== "undefined"
    ? localStorage.getItem(LAST_DAILY_BONUS_KEY)
    : null;
  const lastTs = lastRaw ? Number(lastRaw) : null;
  const eligible =
    !lastTs ||
    Number.isNaN(lastTs) ||
    nowTick - lastTs > 20 * 60 * 60 * 1000;
  const nextClaimAt = lastTs && !Number.isNaN(lastTs)
    ? lastTs + 20 * 60 * 60 * 1000
    : 0;
  const countdownMs = Math.max(0, nextClaimAt - nowTick);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[360px] flex-col overflow-hidden bg-[#F8F9FA] font-sans select-none">
      <header className="relative flex flex-shrink-0 items-center justify-center border-b border-gray-100 bg-white px-2 py-3">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-600"
        >
          ← Назад
        </button>
        <h1 className="text-sm font-black uppercase tracking-wide text-gray-900">
          Задания
        </h1>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* Секция 1: ежедневный бонус */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
            Ежедневный вход
          </h2>
          <div className="mb-4 flex justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => {
              const past = i < safeStreak;
              const current = i === safeStreak;
              return (
                <div
                  key={i}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${
                    past
                      ? "bg-green-500 text-white"
                      : current
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i}
                </div>
              );
            })}
          </div>
          {eligible ? (
            <>
              <p className="mb-2 text-center text-sm text-gray-700">
                Награда: 🍪 {rewardToday.coins} ⚡ {rewardToday.energy}
              </p>
              <button
                type="button"
                onClick={() =>
                  onClaimDailyBonus(rewardToday.coins, rewardToday.energy)
                }
                className="w-full rounded-xl bg-blue-500 py-3 text-sm font-bold text-white shadow-md active:bg-blue-600"
              >
                Забрать бонус
              </button>
            </>
          ) : (
            <p className="text-center text-sm text-gray-600">
              Следующий бонус через {formatCountdown(countdownMs)}
            </p>
          )}
        </section>

        {/* Секция 2: ежедневные задания */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-500">
            Ежедневные задания
          </h2>
          <div className="space-y-3">
            {DAILY_QUESTS.map((task) => {
              const prog =
                quests.progress[task.id as keyof typeof quests.progress];
              const done = prog >= task.goal;
              const claimed = quests.claimed.includes(task.id);
              const pct = Math.min(100, (prog / task.goal) * 100);

              return (
                <div
                  key={task.id}
                  className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="text-xl" aria-hidden>
                        {task.icon}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900">
                          {task.text}
                        </div>
                        <div className="text-xs text-gray-500">
                          Награда: 🍪 {task.reward}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-xs font-bold text-gray-600">
                      {Math.min(prog, task.goal)} / {task.goal}
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    {claimed ? (
                      <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">
                        Получено ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!done}
                        onClick={() => onClaimDailyQuest(task.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                          done
                            ? "bg-green-500 text-white shadow-sm"
                            : "cursor-not-allowed bg-gray-100 text-gray-400"
                        }`}
                      >
                        Забрать ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Секция 3: еженедельная цель */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-gray-500">
            Еженедельная цель
          </h2>
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-xl" aria-hidden>
                  {WEEKLY_QUEST.icon}
                </span>
                <div>
                  <div className="font-bold text-gray-900">
                    {WEEKLY_QUEST.text}
                  </div>
                  <div className="text-xs text-gray-500">
                    Награда: 🍪 {WEEKLY_QUEST.reward}
                  </div>
                </div>
              </div>
              <div className="text-xs font-bold text-gray-600">
                {Math.min(quests.weeklyProgress, WEEKLY_QUEST.goal)} /{" "}
                {WEEKLY_QUEST.goal}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{
                  width: `${Math.min(100, (quests.weeklyProgress / WEEKLY_QUEST.goal) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-end">
              {quests.weeklyClaimed ? (
                <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">
                  Получено ✓
                </span>
              ) : (
                <button
                  type="button"
                  disabled={quests.weeklyProgress < WEEKLY_QUEST.goal}
                  onClick={onClaimWeekly}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    quests.weeklyProgress >= WEEKLY_QUEST.goal
                      ? "bg-green-500 text-white shadow-sm"
                      : "cursor-not-allowed bg-gray-100 text-gray-400"
                  }`}
                >
                  Забрать ✓
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
