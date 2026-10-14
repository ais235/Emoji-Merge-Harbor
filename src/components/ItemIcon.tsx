/**
 * Иконка предмета: спрайт из `public/items/<id>.webp`, при его отсутствии — эмодзи.
 *
 * Так листы можно подключать по одному: пока цепочка не нарисована, она рисуется эмодзи,
 * и игра остаётся работоспособной на любом этапе замены арта.
 */
import { useState } from "react";
import { ALL_ITEMS, type ItemId } from "../types";

/** Id, для которых спрайт уже пробовали загрузить и его не оказалось. */
const missingSprites = new Set<string>();

export interface ItemIconProps {
  itemId: ItemId;
  /** Размер стороны в px; иконка квадратная. */
  size: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ItemIcon({ itemId, size, className, style }: ItemIconProps) {
  const [failed, setFailed] = useState(() => missingSprites.has(itemId));
  const def = ALL_ITEMS[itemId];
  const emoji = def?.emoji ?? "❓";

  if (failed) {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.78, lineHeight: 1, ...style }}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}items/${itemId}.webp`}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
      onError={() => {
        missingSprites.add(itemId);
        setFailed(true);
      }}
    />
  );
}
