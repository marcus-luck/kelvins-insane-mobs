import { EntityComponentTypes, system, world } from "@minecraft/server";
import { rotateY, safely } from "../util";

/**
 * Insane skeletons (incl. strays and bogged): every shot is a 3-arrow volley.
 * The extra arrows vanish after 3 seconds so they can't be farmed.
 */
const SHOOTERS = new Set(["minecraft:skeleton", "minecraft:stray", "minecraft:bogged"]);
const SPREAD_DEG = 9;
const extraArrows = new Set<string>();

export function registerSkeleton(): void {
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId !== "minecraft:arrow") return;
    if (extraArrows.delete(entity.id)) return;
    safely(() => {
      const proj = entity.getComponent(EntityComponentTypes.Projectile);
      const owner = proj?.owner;
      if (!owner || !SHOOTERS.has(owner.typeId)) return;
      const v = entity.getVelocity();
      if (Math.hypot(v.x, v.y, v.z) < 0.1) return;

      for (const deg of [-SPREAD_DEG, SPREAD_DEG]) {
        const arrow = entity.dimension.spawnEntity("minecraft:arrow", entity.location);
        extraArrows.add(arrow.id);
        const p = arrow.getComponent(EntityComponentTypes.Projectile);
        if (!p) continue;
        p.owner = owner;
        p.shoot(rotateY(v, deg));
        system.runTimeout(() => safely(() => arrow.isValid && arrow.remove()), 60);
      }
    });
  });
}
