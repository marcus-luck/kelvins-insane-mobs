import { EntityInitializationCause, system, world } from "@minecraft/server";
import { chance, closestPlayer, firstTime, forEachEntity, lengthXZ, safely, sub } from "../util";

/**
 * Insane zombies:
 *  - permanently fast
 *  - lunge at players from a few blocks away
 *  - 25% chance to split into two baby zombies on death
 */
const LUNGE_COOLDOWN = 60; // ticks
const lastLunge = new Map<string, number>();
const SPLIT_TAG = "kim_split_child";

export function registerZombie(): void {
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    if (entity.typeId !== "minecraft:zombie" || cause === EntityInitializationCause.Loaded) return;
    safely(() => {
      if (firstTime(entity, "kim_zombie")) {
        entity.addEffect("speed", 20000000, { amplifier: 0, showParticles: false });
      }
    });
  });

  system.runInterval(() => {
    forEachEntity("minecraft:zombie", (z) =>
      safely(() => {
        const now = system.currentTick;
        if (now - (lastLunge.get(z.id) ?? -LUNGE_COOLDOWN) < LUNGE_COOLDOWN) return;
        const player = closestPlayer(z.dimension, z.location, 7, 2.5);
        if (!player) return;
        const d = sub(player.location, z.location);
        const len = lengthXZ(d);
        if (len < 0.01) return;
        z.applyKnockback({ x: (d.x / len) * 1.3, z: (d.z / len) * 1.3 }, 0.4);
        z.dimension.playSound("mob.zombie.say", z.location, { pitch: 0.6, volume: 1.2 });
        lastLunge.set(z.id, now);
      })
    );
    if (lastLunge.size > 500) lastLunge.clear();
  }, 10);

  world.afterEvents.entityDie.subscribe(
    ({ deadEntity }) =>
      safely(() => {
        if (deadEntity.hasTag(SPLIT_TAG) || !chance(0.25)) return;
        const { dimension, location } = deadEntity;
        for (let i = 0; i < 2; i++) {
          const baby = dimension.spawnEntity(
            "minecraft:zombie",
            { x: location.x + (i ? 0.4 : -0.4), y: location.y + 0.2, z: location.z },
            { spawnEvent: "minecraft:as_baby" }
          );
          baby.addTag(SPLIT_TAG);
        }
        dimension.playSound("mob.slime.big", location, { pitch: 0.5 });
      }),
    { entityTypes: ["minecraft:zombie"] }
  );
}
