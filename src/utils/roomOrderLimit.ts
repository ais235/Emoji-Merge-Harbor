/**
 * Соответствие зоны апгрейда и зоны поля.
 *
 * Здесь же раньше жила система «лимит заказов миниигры на комнату» (квота по числу
 * купленной мебели). Она была полностью отключена — `GameScreen` получал
 * `ordersExhausted={false}` и `maxMinigameOrdersAtRoom={0}` жёстко, — поэтому удалена.
 */

import { isActiveZone, type ActiveZone, type UpgradeZoneId } from "../types";

/** Зона апгрейда → зона поля / playZone. */
export function upgradeZoneToActiveZone(zone: UpgradeZoneId): ActiveZone | null {
  if (zone === "meta") return null;
  if (zone === "secret_room") return "secret";
  return isActiveZone(zone) ? zone : null;
}
