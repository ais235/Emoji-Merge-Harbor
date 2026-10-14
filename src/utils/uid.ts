/**
 * Идентификаторы экземпляров (например `Order.instanceId`).
 *
 * `crypto.randomUUID()` доступен только в защищённом контексте: по `https://` и по `localhost`,
 * но **не** по `http://192.168.x.x`. Именно так игру открывают при проверке с телефона —
 * и там прямой вызов бросал `TypeError` на инициализации заказов, до первого рендера,
 * то есть страница оставалась пустой.
 *
 * Здесь уникальность нужна только в пределах одной сессии (ключи React и адресация карточки
 * заказа), криптостойкость не требуется — поэтому запасной путь достаточно простой.
 */

let counter = 0;

export function randomId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  // getRandomValues доступен и в незащищённом контексте.
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out;
  }

  counter += 1;
  return `id-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
