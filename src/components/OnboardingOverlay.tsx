/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";

const STEPS: Record<
  1 | 2 | 3,
  { hint: string; cta: string; arrow: "up" | "down" }
> = {
  1: {
    hint: "Нажми на одинаковые предметы рядом — они сольются в новый!",
    cta: "Понятно",
    arrow: "up",
  },
  2: {
    hint: "Выполняй заказы — получай монеты и опыт для прокачки кафе!",
    cta: "Ясно",
    arrow: "up",
  },
  3: {
    hint: "Корзина 🧺 по клику даёт предмет рядом, пока есть заряды (число на клетке). Энергия восстанавливается со временем!",
    cta: "Начать играть!",
    arrow: "down",
  },
};

export interface OnboardingOverlayProps {
  onComplete: () => void;
}

/** Онбординг поверх GameScreen: оверлей pointer-events-none, клики проходят к полю; только карточка ловит события. */
export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const content = STEPS[step];

  const advance = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Обучение"
    >
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.6)] pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
        <div className="onboard-arrow-area flex flex-1 flex-col items-center justify-center pb-4">
          <span
            className={`onboard-arrow select-none text-6xl leading-none text-white drop-shadow-lg filter ${content.arrow === "up" ? "onboard-bounce-up" : "onboard-bounce-down"}`}
            aria-hidden
          >
            {content.arrow === "up" ? "↑" : "↓"}
          </span>
          <span className="mt-2 max-w-[280px] text-center text-xs font-bold uppercase tracking-wide text-white/90">
            {step === 1 && "Слияние"}
            {step === 2 && "Заказы"}
            {step === 3 && "Корзина"}
          </span>
        </div>

        <div className="pointer-events-auto z-20 mx-auto w-full max-w-[360px] rounded-t-3xl bg-white px-4 pb-6 pt-4 shadow-[0_-8px_32px_rgba(0,0,0,0.2)]">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {step} / 3
          </p>
          <p className="mb-4 text-center text-sm leading-snug text-gray-800">
            {content.hint}
          </p>
          <button
            type="button"
            onClick={advance}
            className="w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ backgroundColor: "#378ADD" }}
          >
            {content.cta}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes onboard-bob-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes onboard-bob-down {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(10px); }
        }
        .onboard-bounce-up { animation: onboard-bob-up 1.2s ease-in-out infinite; }
        .onboard-bounce-down { animation: onboard-bob-down 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
