import { Block, Dimension, Entity, GameMode, Vector3, system, world } from "@minecraft/server";
import { DIMENSIONS, safely } from "../util";

/**
 * Poop block (kim:poop):
 *  - gravity: with nothing underneath it turns into a falling entity
 *  - on landing it splats into a Poop Puddle (kim:poop_puddle) with a slime sound
 *  - puddles pop when the block under them is gone, and they slow down players walking through
 * Block sounds (slime) come from RP/blocks.json.
 */
const POOP = "kim:poop";
const PUDDLE = "kim:poop_puddle";
const FALLING = "kim:falling_poop";

/** Blocks a falling poop can fall through / replace. */
function isPassable(b: Block | undefined): boolean {
  if (!b) return false;
  return b.isAir || b.isLiquid || b.typeId === "minecraft:short_grass" || b.typeId === "minecraft:tall_grass" || b.typeId === "minecraft:fern";
}

function startFalling(block: Block) {
  const below = block.below();
  if (!isPassable(below)) return;
  const { dimension, location } = block;
  block.setType("minecraft:air");
  dimension.spawnEntity(FALLING, { x: location.x + 0.5, y: location.y, z: location.z + 0.5 });
}

function splat(e: Entity) {
  const dim: Dimension = e.dimension;
  const at: Vector3 = { x: Math.floor(e.location.x), y: Math.floor(e.location.y + 0.2), z: Math.floor(e.location.z) };
  e.remove();
  const spot = dim.getBlock(at);
  const floor = spot?.below();
  if (spot && floor && isPassable(spot) && !floor.isAir && !floor.isLiquid && floor.typeId !== PUDDLE) {
    spot.setType(PUDDLE);
  }
  dim.playSound("mob.slime.big", at, { pitch: 0.6, volume: 1.2 });
  dim.playSound("mob.slime.squish", at, { pitch: 0.8 });
}

export function registerPoop(): void {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("kim:gravity_poop", {
      onPlace: ({ block }) => safely(() => startFalling(block)),
      onTick: ({ block }) => safely(() => startFalling(block)),
    });
    blockComponentRegistry.registerCustomComponent("kim:puddle_support", {
      onTick: ({ block }) =>
        safely(() => {
          const below = block.below();
          if (!below || below.isAir || below.isLiquid) block.setType("minecraft:air");
        }),
    });
  });

  // Land falling poops. isOnGround (or no longer moving) after the first few ticks = landed.
  const age = new Map<string, number>();
  system.runInterval(() => {
    for (const id of DIMENSIONS) {
      for (const e of world.getDimension(id).getEntities({ type: FALLING })) {
        safely(() => {
          const ticks = (age.get(e.id) ?? 0) + 1;
          age.set(e.id, ticks);
          const vy = e.getVelocity().y;
          if (ticks > 2 && (e.isOnGround || Math.abs(vy) < 0.001)) {
            age.delete(e.id);
            splat(e);
          } else if (ticks > 600) {
            age.delete(e.id);
            e.remove();
          }
        });
      }
    }
  }, 1);

  // Mucky puddles: slowness while standing in one.
  system.runInterval(() => {
    for (const p of world.getPlayers()) {
      safely(() => {
        if (p.getGameMode() === GameMode.Spectator) return;
        const b = p.dimension.getBlock(p.location);
        if (b?.typeId === PUDDLE) p.addEffect("slowness", 15, { amplifier: 2, showParticles: false });
      });
    }
  }, 5);
}
