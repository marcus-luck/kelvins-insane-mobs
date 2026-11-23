import { system, world } from "@minecraft/server";
import { chance, safely } from "../util";

/**
 * Insane spiders: their bites can web you in place (cobweb at your feet for 5 seconds).
 */
const SPIDERS = new Set(["minecraft:spider", "minecraft:cave_spider"]);
const WEB = "minecraft:web";

export function registerSpider(): void {
  world.afterEvents.entityHurt.subscribe(
    ({ hurtEntity, damageSource }) =>
      safely(() => {
        const attacker = damageSource.damagingEntity;
        if (!attacker || !SPIDERS.has(attacker.typeId) || !chance(0.35)) return;
        const dim = hurtEntity.dimension;
        const at = hurtEntity.location;
        const block = dim.getBlock(at);
        if (!block?.isAir) return;
        block.setType(WEB);
        dim.playSound("mob.spider.say", at, { pitch: 1.4 });
        system.runTimeout(
          () =>
            safely(() => {
              const b = dim.getBlock(at);
              if (b?.typeId === WEB) b.setType("minecraft:air");
            }),
          100
        );
      }),
    { entityTypes: ["minecraft:player"] }
  );
}
