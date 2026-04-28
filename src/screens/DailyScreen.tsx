/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useUiScaling } from "../hooks/useUiScaling";
import { Coins, Home } from "lucide-react";
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

  const lastRaw = typeof localStorage !== "undefined" ? localStorage.getItem(LAST_DAILY_BONUS_KEY) : null;
  const lastTs = lastRaw ? Number(lastRaw) : null;
  const eligible =
    !lastTs || Number.isNaN(lastTs) || nowTick - lastTs > 20 * 60 * 60 * 1000;
  const nextClaimAt = lastTs && !Number.isNaN(lastTs) ? lastTs + 20 * 60 * 60 * 1000 : 0;
  const countdownMs = Math.max(0, nextClaimAt - nowTick);

  const { containerRef, uiScale, scalingStyle } = useUiScaling();

  return (
    <div
      ref={containerRef}
      className="ds-screen flex flex-col overflow-hidden"
      style={scalingStyle}
    >
      <header className="ds-topbar">
        <button type="button" onClick={onBack} className="ds-pill-home shrink-0 gap-1.5">
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          Дом
        </button>
        <h1 className="ds-topbar-title">Задания</h1>
        <span className="ds-topbar-spacer" aria-hidden />
      </header>

      <div className="no-scrollbar scroll-touch-y min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <section className="ds-card">
          <h2 className="mb-3 text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
            Ежедневный вход
          </h2>
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => {
              const past = i < safeStreak;
              const current = i === safeStreak;
              return (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-medium"
                  style={
                    past
                      ? { background: "var(--c-green)", color: "#fff" }
                      : current
                        ? { background: "var(--c-rosedark)", color: "#fff" }
                        : {
                            background: "var(--c-peach)",
                            border: "1px solid var(--c-peach2)",
                            color: "var(--c-muted)",
                          }
                  }
                >
                  {i}
                </div>
              );
            })}
          </div>
          {eligible ? (
            <>
              <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-[12px] font-medium" style={{ color: "var(--c-browndark)" }}>
                Награда:
                <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                {rewardToday.coins}
                <span>· ⚡ {rewardToday.energy}</span>
              </p>
              <button type="button" onClick={() => onClaimDailyBonus(rewardToday.coins, rewardToday.energy)} className="ds-btn-primary w-full">
                Забрать бонус
              </button>
            </>
          ) : (
            <p className="text-center text-[12px] font-medium" style={{ color: "var(--c-brown)" }}>
              Следующий бонус через {formatCountdown(countdownMs)}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
            Ежедневные задания
          </h2>
          <div className="space-y-3">
            {DAILY_QUESTS.map((task) => {
              const prog = quests.progress[task.id as keyof typeof quests.progress];
              const done = prog >= task.goal;
              const claimed = quests.claimed.includes(task.id);
              const pct = Math.min(100, (prog / task.goal) * 100);

              return (
                <div key={task.id} className="ds-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="text-xl" aria-hidden>
                        {task.id === "dq_coins" ? (
                          <Coins className="h-5 w-5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                        ) : (
                          task.icon
                        )}
                      </span>
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: "var(--c-browndark)" }}>
                          {task.text}
                        </div>
                        <div className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
                          Награда:
                          <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                          {task.reward}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: "var(--c-brown)" }}>
                      {Math.min(prog, task.goal)} / {task.goal}
                    </div>
                  </div>
                  <div className="ds-progress mt-2 w-full">
                    <div className="ds-progress__fill ds-progress__fill--blue" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex justify-end">
                    {claimed ? (
                      <span
                        className="rounded-[var(--ds-radius-btn)] border px-3 py-2 text-[10px] font-medium"
                        style={{
                          background: "var(--c-peach)",
                          borderColor: "var(--c-peach2)",
                          color: "var(--c-muted)",
                        }}
                      >
                        Получено ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!done}
                        onClick={() => onClaimDailyQuest(task.id)}
                        className={done ? "ds-btn-green" : "ds-btn-secondary ds-btn-disabled min-h-[36px] text-[10px]"}
                      >
                        Забрать
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
            Еженедельная цель
          </h2>
          <div className="ds-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="text-xl" aria-hidden>
                  {WEEKLY_QUEST.icon}
                </span>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--c-browndark)" }}>
                    {WEEKLY_QUEST.text}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
                    Награда:
                    <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                    {WEEKLY_QUEST.reward}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-medium tabular-nums" style={{ color: "var(--c-brown)" }}>
                {Math.min(quests.weeklyProgress, WEEKLY_QUEST.goal)} / {WEEKLY_QUEST.goal}
              </div>
            </div>
            <div className="ds-progress mt-2 w-full">
              <div
                className="ds-progress__fill ds-progress__fill--gold"
                style={{
                  width: `${Math.min(100, (quests.weeklyProgress / WEEKLY_QUEST.goal) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-end">
              {quests.weeklyClaimed ? (
                <span
                  className="rounded-[var(--ds-radius-btn)] border px-3 py-2 text-[10px] font-medium"
                  style={{
                    background: "var(--c-peach)",
                    borderColor: "var(--c-peach2)",
                    color: "var(--c-muted)",
                  }}
                >
                  Получено ✓
                </span>
              ) : (
                <button
                  type="button"
                  disabled={quests.weeklyProgress < WEEKLY_QUEST.goal}
                  onClick={onClaimWeekly}
                  className={
                    quests.weeklyProgress >= WEEKLY_QUEST.goal
                      ? "ds-btn-green"
                      : "ds-btn-secondary ds-btn-disabled min-h-[36px] text-[10px]"
                  }
                >
                  Забрать
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
