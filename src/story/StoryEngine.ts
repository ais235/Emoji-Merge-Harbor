/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProgressionState } from "../types";
import { progressZoneId } from "../types";
import type { StoryBeat, StoryCondition } from "./storyData";
import { STORY_BEATS } from "./storyData";

export class StoryEngine {
  constructor(private readonly shownBeats: string[]) {}

  getNextBeat(
    progState: ProgressionState,
    ordersCompleted: number
  ): StoryBeat | null {
    for (const beat of STORY_BEATS) {
      if (beat.chainOnly) continue;
      if (beat.shownOnce && this.shownBeats.includes(beat.id)) continue;
      if (this.conditionMet(beat.condition, progState, ordersCompleted)) {
        return beat;
      }
    }
    return null;
  }

  markShown(beatId: string): string[] {
    if (this.shownBeats.includes(beatId)) return [...this.shownBeats];
    return [...this.shownBeats, beatId];
  }

  private conditionMet(
    c: StoryCondition,
    prog: ProgressionState,
    ordersCompleted: number
  ): boolean {
    switch (c.type) {
      case "level":
        return prog.level >= c.value;
      case "zone_unlocked":
        return prog.unlockedZones.includes(progressZoneId(c.zone));
      case "upgrade_bought":
        return prog.purchasedUpgrades.includes(
          c.upgradeId === "chair" ? "chair_fix" : c.upgradeId
        );
      case "orders_completed":
        return ordersCompleted >= c.count;
      default:
        return false;
    }
  }
}
