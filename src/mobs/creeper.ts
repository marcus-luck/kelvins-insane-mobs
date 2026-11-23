import { EntityInitializationCause, system, world } from "@minecraft/server";
import { chance, closestPlayer, firstTime, forEachEntity, lengthXZ, safely } from "../util";

/**
 * Insane creepers:
 *  - 10% spawn already charged
 *  - occasionally blink (teleport) right behind a nearby player
 */
const BLINK_COOLDOWN = 200; // ticks
const lastBlink = new Map<string, number>();

export function registerCreeper(): void {
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (entity.typeId !== "minecraft:creeper" || cause === EntityInitializationCause.Loaded) return;
    safely(() => {
      if (firstTime(entity, "kim_creeper") && chance(0.1)) entity.triggerEvent("minecraft:become_charged");
    });
  });

  system.runInterval(() => {
    forEachEntity("minecraft:creeper", (c) =>
      safely(() => {
        const now = system.currentTick;
        if (now - (lastBlink.get(c.id) ?? -BLINK_COOLDOWN) < BLINK_COOLDOWN) return;
        if (!chance(0.2)) return;
        const player = closestPlayer(c.dimension, c.location, 20, 5);
        if (!player) return;

        // 2.5 blocks behind where the player is looking
        const view = player.getViewDirection();
        const len = lengthXZ(view) || 1;
        const dest = {
          x: player.location.x - (view.x / len) * 2.5,
          y: player.location.y,
          z: player.location.z - (view.z / len) * 2.5,
        };
        const dim = c.dimension;
        const feet = dim.getBlock(dest);
        const head = feet?.above();
        const floor = feet?.below();
        if (!feet?.isAir || !head?.isAir || !floor || floor.isAir || floor.isLiquid) return;

        const from = c.location;
        c.teleport({ x: Math.floor(dest.x) + 0.5, y: Math.floor(dest.y), z: Math.floor(dest.z) + 0.5 }, { facingLocation: player.location });
        lastBlink.set(c.id, now);
        for (const at of [from, dest]) {
          dim.playSound("mob.endermen.portal", at, { pitch: 0.7 });
          for (let i = 0; i < 6; i++) {
            safely(() =>
              dim.spawnParticle("minecraft:basic_portal_particle", {
                x: at.x + Math.random() - 0.5,
                y: at.y + Math.random() * 1.6,
                z: at.z + Math.random() - 0.5,
              })
            );
          }
        }
      })
    );
    if (lastBlink.size > 500) lastBlink.clear();
  }, 40);
}
