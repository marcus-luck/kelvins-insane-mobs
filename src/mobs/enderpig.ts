import { Dimension, Entity, Vector3, system, world } from "@minecraft/server";
import { closestPlayer, forEachEntity, safely } from "../util";

/**
 * Enderpig (custom, kim:enderpig): a friendly long-legged black pig that acts like an enderman.
 * Random teleports, arrow dodging and water hatred live in the entity JSON. Here:
 *  - stare at it and it happily teleports right next to you (hearts + oink)
 *  - when hurt it blinks away to a nearby safe spot
 *  - it constantly leaks portal particles
 */
const ID = "kim:enderpig";

function safeSpotNear(dim: Dimension, center: Vector3, radius: number): Vector3 | undefined {
  for (let attempt = 0; attempt < 12; attempt++) {
    const x = Math.floor(center.x + (Math.random() * 2 - 1) * radius);
    const z = Math.floor(center.z + (Math.random() * 2 - 1) * radius);
    for (let y = Math.floor(center.y) + 6; y > center.y - 8; y--) {
      const floor = dim.getBlock({ x, y: y - 1, z });
      if (!floor || floor.isAir || floor.isLiquid) continue;
      const a = dim.getBlock({ x, y, z });
      const b = dim.getBlock({ x, y: y + 1, z });
      const c = dim.getBlock({ x, y: y + 2, z });
      if (a?.isAir && b?.isAir && c?.isAir) return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return undefined;
}

function blink(pig: Entity, to: Vector3, facing?: Vector3) {
  const dim = pig.dimension;
  const from = pig.location;
  pig.teleport(to, facing ? { facingLocation: facing } : undefined);
  for (const at of [from, to]) {
    dim.playSound("mob.endermen.portal", at, { pitch: 1.2 });
    for (let i = 0; i < 10; i++) {
      safely(() =>
        dim.spawnParticle("minecraft:basic_portal_particle", {
          x: at.x + Math.random() - 0.5,
          y: at.y + Math.random() * 2.5,
          z: at.z + Math.random() - 0.5,
        })
      );
    }
  }
}

export function registerEnderpig(): void {
  world.afterEvents.dataDrivenEntityTrigger.subscribe(
    ({ entity: pig, eventId }) =>
      safely(() => {
        if (eventId !== "kim:stared_at") return;
        const player = closestPlayer(pig.dimension, pig.location, 32);
        if (!player) return;
        const spot = safeSpotNear(pig.dimension, player.location, 2);
        if (!spot) return;
        blink(pig, spot, player.location);
        pig.dimension.playSound("mob.pig.say", spot, { pitch: 1.4 });
        for (let i = 0; i < 5; i++) {
          safely(() =>
            pig.dimension.spawnParticle("minecraft:heart_particle", {
              x: spot.x + Math.random() - 0.5,
              y: spot.y + 2.6 + Math.random() * 0.5,
              z: spot.z + Math.random() - 0.5,
            })
          );
        }
      }),
    { entityTypes: [ID] }
  );

  world.afterEvents.entityHurt.subscribe(
    ({ hurtEntity: pig }) =>
      safely(() => {
        if (!pig.isValid || Math.random() > 0.6) return;
        const spot = safeSpotNear(pig.dimension, pig.location, 12);
        if (spot) blink(pig, spot);
      }),
    { entityTypes: [ID] }
  );

  system.runInterval(() => {
    forEachEntity(ID, (pig) =>
      safely(() =>
        pig.dimension.spawnParticle("minecraft:basic_portal_particle", {
          x: pig.location.x + (Math.random() - 0.5) * 0.8,
          y: pig.location.y + 1 + Math.random() * 1.6,
          z: pig.location.z + (Math.random() - 0.5) * 0.8,
        })
      )
    );
  }, 8);
}
