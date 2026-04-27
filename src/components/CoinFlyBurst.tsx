/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playSfx } from "../utils/playSfx";

const FLY_MS = 700;
const HEADER_COIN_ID = "header-coin-icon";

export type CoinFlyBurstSpec = {
  id: number;
  cx: number;
  cy: number;
  count: number;
};

type CoinItem = { key: string; startX: number; startY: number; delay: number };

function fanOffset(i: number, n: number): { x: number; y: number } {
  if (n <= 1) return { x: 0, y: 0 };
  const t = (i / (n - 1)) * 60 - 30;
  const rad = (t * Math.PI) / 180;
  return { x: Math.sin(rad) * 30, y: Math.cos(rad) * 20 - 20 };
}

function SingleCoin({
  startX,
  startY,
  delay,
  onOneLanded,
}: CoinItem & { onOneLanded: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tStart = window.setTimeout(() => {
      const cur = ref.current;
      const target = document.getElementById(HEADER_COIN_ID);
      if (!cur) return;

      const finish = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        onOneLanded();
      };

      if (!target) {
        finish();
        return;
      }
      const tr = target.getBoundingClientRect();
      const tx = tr.left + tr.width / 2;
      const ty = tr.top + tr.height / 2;
      cur.style.transition = `left ${FLY_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), top ${FLY_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform ${FLY_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${FLY_MS}ms ease-out`;
      cur.style.left = `${tx}px`;
      cur.style.top = `${ty}px`;
      cur.style.transform = "translate(-50%, -50%) scale(0.35)";
      cur.style.opacity = "0";
      window.setTimeout(finish, FLY_MS);
    }, delay);

    return () => window.clearTimeout(tStart);
  }, [delay, onOneLanded]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: `${startX}px`,
        top: `${startY}px`,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, #FFE566, #F5A623)",
        border: "2px solid #D4810A",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        transform: "translate(-50%, -50%)",
        opacity: 1,
        transition: "none",
      }}
      aria-hidden
    />
  );
}

export default function CoinFlyBurst({
  burst,
  onFinished,
}: {
  burst: CoinFlyBurstSpec | null;
  onFinished?: () => void;
}) {
  const [coins, setCoins] = useState<CoinItem[]>([]);
  const landedRef = useRef(0);
  const totalRef = useRef(0);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const onOneLanded = useCallback(() => {
    landedRef.current += 1;
    const n = totalRef.current;
    const target = document.getElementById(HEADER_COIN_ID);
    if (target && n > 0 && landedRef.current === n) {
      playSfx("coin_land", 0.45);
      target.classList.add("coin-pulse");
      window.setTimeout(() => target.classList.remove("coin-pulse"), 320);
      setCoins([]);
      onFinishedRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!burst) {
      setCoins([]);
      return;
    }
    landedRef.current = 0;
    const n = Math.min(8, Math.max(5, Math.floor(burst.count) || 7));
    totalRef.current = n;
    const list: CoinItem[] = [];
    for (let i = 0; i < n; i++) {
      const { x: sx, y: sy } = fanOffset(i, n);
      list.push({
        key: `${burst.id}-c-${i}`,
        startX: burst.cx + sx + (Math.random() - 0.5) * 8,
        startY: burst.cy + sy + (Math.random() - 0.5) * 8,
        delay: i * 42,
      });
    }
    setCoins(list);
    playSfx("coin_fly", 0.35);
  }, [burst]);

  if (typeof document === "undefined" || (coins.length === 0 && !burst)) return null;
  if (coins.length === 0) return null;

  return createPortal(
    <>
      {coins.map((c) => (
        <SingleCoin key={c.key} {...c} onOneLanded={onOneLanded} />
      ))}
    </>,
    document.body
  );
}
