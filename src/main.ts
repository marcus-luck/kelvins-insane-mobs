import { world } from "@minecraft/server";
import { registerCreeper } from "./mobs/creeper";
import { registerEnderpig } from "./mobs/enderpig";
import { registerFlappyGhast } from "./mobs/flappy_ghast";
import { registerSkeleton } from "./mobs/skeleton";
import { registerSpider } from "./mobs/spider";
import { registerZombie } from "./mobs/zombie";

registerZombie();
registerCreeper();
registerSkeleton();
registerSpider();
registerFlappyGhast();
registerEnderpig();

world.afterEvents.worldLoad.subscribe(() => {
  console.warn("[Kelvin's Insane Mobs] loaded. Good luck.");
});
