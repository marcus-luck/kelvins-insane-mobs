import { Dimension, Entity, EntityComponentTypes, Player, Vector3, system, world } from "@minecraft/server";
import { forEachEntity, safely } from "../util";

/**
 * Flappy Ghast (custom mount, kim:flappy_ghast):
 *  - Right-click (holding any item) while riding: shoots a fireball where you look that
 *    explodes like TNT and sets fire. The API can't detect empty-hand right-clicks.
 *  - Sprint-boost: hold forward and fly straight and it keeps accelerating, up to MAX_BOOST x.
 *    Turning bleeds the boost off; letting go of forward resets it.
 */
const ID = "kim:flappy_ghast";
const BASE_SPEED = 0.03; // must match movement / flying_speed in the entity JSON
const MAX_BOOST = 25;
const BOOST_GAIN = 0.08; // per tick-step (every 2 ticks); ~10 s from 1x to max
const MAX_TURN_DEG = 5; // yaw change per step that still counts as "straight"
const FIRE_COOLDOWN = 20; // 1 shot per second
const TNT_POWER = 4; // same as TNT

const boost = new Map<string, { level: number; yaw: number; tier: number }>();
const lastShot = new Map<string, number>();
const shots = new Map<string, { owner: Player; dim: Dimension; last: Vector3; born: number }>();

function controllingPlayer(ghastId: string) {
  const ghast = world.getEntity(ghastId);
  const riders = ghast?.getComponent(EntityComponentTypes.Rideable)?.getRiders() ?? [];
  const first = riders[0];
  return first instanceof Player ? first : undefined;
}

function setSpeed(ghastId: string, mult: number) {
  const ghast = world.getEntity(ghastId);
  if (!ghast) return;
  const fly = ghast.getComponent(EntityComponentTypes.FlyingSpeed);
  if (fly) fly.value = BASE_SPEED * mult;
  ghast.getComponent(EntityComponentTypes.Movement)?.setCurrentValue(BASE_SPEED * mult);
}

export function registerFlappyGhast(): void {
  // ---- speed boost
  system.runInterval(() => {
    forEachEntity(ID, (ghast) =>
      safely(() => {
        const rider = controllingPlayer(ghast.id);
        const state = boost.get(ghast.id) ?? { level: 1, yaw: 0, tier: 0 };
        if (!rider) {
          if (state.level !== 1) setSpeed(ghast.id, 1);
          boost.delete(ghast.id);
          return;
        }
        const mv = rider.inputInfo.getMovementVector();
        const yaw = rider.getRotation().y;
        const turn = Math.abs((((yaw - state.yaw) % 360) + 540) % 360 - 180);
        const forward = mv.y > 0.7 && Math.abs(mv.x) < 0.35;

        if (forward && turn <= MAX_TURN_DEG) state.level = Math.min(MAX_BOOST, state.level + BOOST_GAIN * state.level ** 0.5);
        else if (forward) state.level = Math.max(1, state.level * 0.9);
        else state.level = 1;
        state.yaw = yaw;
        setSpeed(ghast.id, state.level);

        const tier = Math.floor(state.level / 5); // ding every 5x
        if (tier > state.tier) {
          ghast.dimension.playSound("random.orb", ghast.location, { pitch: 0.6 + (tier / (MAX_BOOST / 5)) * 1.4, volume: 1 });
        }
        state.tier = tier;
        boost.set(ghast.id, state);

        if (state.level > 1.05) {
          const bar = "|".repeat(Math.round((state.level / MAX_BOOST) * 20)).padEnd(20, ".");
          rider.onScreenDisplay.setActionBar(`§dBOOST §b[${bar}] §f${state.level.toFixed(1)}x`);
        }
        if (state.level >= 3) {
          const v = ghast.getVelocity();
          safely(() =>
            ghast.dimension.spawnParticle("minecraft:basic_flame_particle", {
              x: ghast.location.x - v.x * 3,
              y: ghast.location.y + 1.5,
              z: ghast.location.z - v.z * 3,
            })
          );
        }
        // flappy flap sounds, faster when faster
        if (mv.y !== 0 || mv.x !== 0) {
          const every = Math.max(2, Math.round(12 / state.level)) * 2;
          if (system.currentTick % every === 0) {
            ghast.dimension.playSound("mob.enderdragon.flap", ghast.location, { pitch: 1.6, volume: 0.6 });
          }
        }
      })
    );
  }, 2);

  // ---- TNT fireballs: right-click with any item while riding
  world.afterEvents.itemUse.subscribe(({ source: player }) =>
    safely(() => {
      const mount = player.getComponent(EntityComponentTypes.Riding)?.entityRidingOn;
      if (mount?.typeId !== ID) return;
      const now = system.currentTick;
      if (now - (lastShot.get(player.id) ?? -FIRE_COOLDOWN) < FIRE_COOLDOWN) return;
      lastShot.set(player.id, now);

      const dir = player.getViewDirection();
      const head = player.getHeadLocation();
      // start further out when aiming down so the shot clears the ghast's own body
      const dist = 3.5 + Math.max(0, -dir.y) * 3;
      const spawnAt = { x: head.x + dir.x * dist, y: head.y + dir.y * dist, z: head.z + dir.z * dist };
      const fireball = player.dimension.spawnEntity("minecraft:fireball", spawnAt);
      shots.set(fireball.id, { owner: player, dim: player.dimension, last: spawnAt, born: now });
      const proj = fireball.getComponent(EntityComponentTypes.Projectile);
      if (proj) {
        proj.owner = player;
        proj.shoot({ x: dir.x * 1.8, y: dir.y * 1.8, z: dir.z * 1.8 });
      }
      player.dimension.playSound("mob.ghast.fireball", head, { pitch: 1.3 });
    })
  );

  const boom = (id: string, at: Vector3) => {
    const shot = shots.get(id);
    if (!shot) return;
    shots.delete(id);
    safely(() => {
      shot.dim.createExplosion(at, TNT_POWER, { breaksBlocks: true, causesFire: true, source: shot.owner.isValid ? shot.owner : undefined });
    });
  };
  const hitId = (e: Entity) => {
    try {
      return e.id;
    } catch {
      return undefined;
    }
  };
  world.afterEvents.projectileHitBlock.subscribe(({ projectile, location }) => {
    const id = hitId(projectile);
    if (id) boom(id, location);
  });
  world.afterEvents.projectileHitEntity.subscribe(({ projectile, location }) => {
    const id = hitId(projectile);
    if (id) boom(id, location);
  });
  // fallback: a shot that vanished without a hit event explodes where it was last seen
  system.runInterval(() => {
    for (const [id, shot] of shots) {
      const e = world.getEntity(id);
      if (e?.isValid) {
        shot.last = e.location;
        if (system.currentTick - shot.born > 200) {
          shots.delete(id);
          safely(() => e.remove());
        }
      } else boom(id, shot.last);
    }
  }, 1);
}
