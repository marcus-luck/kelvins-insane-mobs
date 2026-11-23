import { world } from "@minecraft/server";
import { registerCreeper } from "./mobs/creeper";
import { registerSkeleton } from "./mobs/skeleton";
import { registerSpider } from "./mobs/spider";
import { registerZombie } from "./mobs/zombie";

registerZombie();
registerCreeper();
registerSkeleton();
registerSpider();

world.afterEvents.worldLoad.subscribe(() => {
  console.warn("[Kelvin's Insane Mobs] loaded. Good luck.");
});
