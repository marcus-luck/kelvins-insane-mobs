import { Entity, EntityComponentTypes, Player, Vector3, system, world } from "@minecraft/server";
import { forEachEntity, safely } from "../util";

/**
 * Flappy Ghast (custom mount, kim:flappy_ghast):
 *  - Right-click while riding: shoots a fireball where you look that explodes like TNT and
 *    sets fire. Fires on right-clicking the ghast itself (any hand) or into the air holding an
 *    item. The API can't see empty-hand right-clicks into the air.
 *  - Sprint-boost: hold forward and fly straight and it keeps accelerating, up to MAX_BOOST x.
 *    Turning bleeds the boost off; letting go of forward resets it.
 */
const ID = "kim:flappy_ghast";
const BASE_SPEED = 0.03; // must match movement / flying_speed in the entity JSON
const MAX_BOOST = 25;
const BOOST_GAIN = 0.08; // per tick-step (every 2 ticks); ~10 s from 1x to max
const MAX_TURN_DEG = 5; // yaw change per step that still counts as "straight"
const FIRE_COOLDOWN = 2; // up to 10 shots per second
const FIREBALL = "kim:tnt_fireball";
const SHOT_SPEED = 4.5; // blocks per tick, flown by script in a dead-straight line
const SHOT_LIFE = 120; // ticks (~540 blocks), then it pops in the air
const TNT_POWER = 4;
const CONVERTIBLE = new Set(["minecraft:snowball", "minecraft:arrow", "minecraft:egg", "minecraft:thrown_trident", "minecraft:ender_pearl"]);

const boost = new Map<string, { level: number; yaw: number; tier: number }>();
const lastShot = new Map<string, number>();
const inFlight = new Map<string, { e: Entity; owner: Player; mountId: string | undefined; pos: Vector3; dir: Vector3; age: number }>();

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

  // ---- TNT fireballs (kim:tnt_fireball explodes itself on hit, see BP/entities/tnt_fireball.json).
  // Vanilla minecraft:fireball is not summonable, so scripts can't spawn it.
  const ridingFlappy = (player: Player) => player.getComponent(EntityComponentTypes.Riding)?.entityRidingOn?.typeId === ID;

  const fire = (player: Player) => {
    try {
      if (!ridingFlappy(player)) return;
      const now = system.currentTick;
      if (now - (lastShot.get(player.id) ?? -FIRE_COOLDOWN) < FIRE_COOLDOWN) return;
      lastShot.set(player.id, now);

      const dir = player.getViewDirection();
      const head = player.getHeadLocation();
      // start further out when aiming down so the shot clears the ghast's own body
      const dist = 3.5 + Math.max(0, -dir.y) * 3;
      const spawnAt = { x: head.x + dir.x * dist, y: head.y + dir.y * dist, z: head.z + dir.z * dist };
      const fireball = player.dimension.spawnEntity(FIREBALL, spawnAt);
      const mountId = player.getComponent(EntityComponentTypes.Riding)?.entityRidingOn?.id;
      inFlight.set(fireball.id, { e: fireball, owner: player, mountId, pos: spawnAt, dir, age: 0 });
      player.dimension.playSound("mob.ghast.fireball", head, { pitch: 1.3 });
    } catch (e) {
      console.warn(`[Kelvin's Insane Mobs] flappy ghast shot failed: ${e}`);
    }
  };

  // Fly fireballs by script: straight line, SHOT_SPEED blocks per tick, our own hit detection.
  // (Game physics let explosions shove them around.)
  const explode = (id: string, at: Vector3) => {
    const shot = inFlight.get(id);
    inFlight.delete(id);
    if (!shot) return;
    const dim = shot.e.dimension;
    safely(() => shot.e.remove());
    safely(() =>
      dim.createExplosion(at, TNT_POWER, { breaksBlocks: true, causesFire: true, source: shot.owner.isValid ? shot.owner : undefined })
    );
  };
  system.runInterval(() => {
    for (const [id, shot] of inFlight) {
      if (!shot.e.isValid) {
        inFlight.delete(id);
        continue;
      }
      try {
        const { pos, dir } = shot;
        const dim = shot.e.dimension;
        const along = (d: number) => ({ x: pos.x + dir.x * d, y: pos.y + dir.y * d, z: pos.z + dir.z * d });
        let hitDist = Infinity;
        const block = dim.getBlockFromRay(pos, dir, { maxDistance: SHOT_SPEED, includeLiquidBlocks: true, includePassableBlocks: false });
        if (block) {
          const b = block.block.location;
          const f = block.faceLocation;
          const at = { x: b.x + f.x, y: b.y + f.y, z: b.z + f.z };
          hitDist = Math.hypot(at.x - pos.x, at.y - pos.y, at.z - pos.z);
        }
        for (const hit of dim.getEntitiesFromRay(pos, dir, { maxDistance: SHOT_SPEED })) {
          const t = hit.entity;
          if (t.id === shot.owner.id || t.id === shot.mountId || t.typeId === FIREBALL) continue;
          if (hit.distance < hitDist) hitDist = hit.distance;
          break;
        }
        if (hitDist <= SHOT_SPEED) {
          explode(id, along(Math.max(0, hitDist - 0.3)));
          continue;
        }
        if (++shot.age > SHOT_LIFE) {
          explode(id, pos);
          continue;
        }
        shot.pos = along(SHOT_SPEED);
        shot.e.teleport(shot.pos);
      } catch {
        // flew into unloaded chunks
        inFlight.delete(id);
        safely(() => shot.e.remove());
      }
    }
  }, 1);

  // leftovers from before a reload (not tracked any more) just vanish
  system.runInterval(() => forEachEntity(FIREBALL, (e) => void (inFlight.has(e.id) || safely(() => e.remove()))), 100);

  // Right-click while holding any item (works while riding).
  world.afterEvents.itemUse.subscribe(({ source }) => fire(source));

  // Hold right-click = auto-fire. The game only reports "holding" for chargeable/usable items
  // (Ghast Blaster, bow, crossbow, trident, food...), so those auto-fire until released.
  const holding = new Map<string, Player>();
  world.afterEvents.itemStartUse.subscribe(({ source }) => holding.set(source.id, source));
  world.afterEvents.itemStopUse.subscribe(({ source }) => holding.delete(source.id));
  world.afterEvents.itemReleaseUse.subscribe(({ source }) => holding.delete(source.id));
  world.afterEvents.itemCompleteUse.subscribe(({ source }) => holding.delete(source.id));
  system.runInterval(() => {
    for (const [id, p] of holding) {
      if (!p.isValid || !ridingFlappy(p)) holding.delete(id);
      else fire(p);
    }
  }, 1);

  // Throwables/arrows used while riding are swallowed: itemUse already fired the fireball.
  world.afterEvents.entitySpawn.subscribe(({ entity }) =>
    safely(() => {
      if (!CONVERTIBLE.has(entity.typeId)) return;
      const owner = entity.getComponent(EntityComponentTypes.Projectile)?.owner;
      if (owner instanceof Player && ridingFlappy(owner)) entity.remove();
    })
  );

  // Right-click while the crosshair is on the ghast you're sitting on (works with an empty hand).
  world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    if (ev.target.typeId !== ID) return;
    const ridingThis = ev.player.getComponent(EntityComponentTypes.Riding)?.entityRidingOn?.id === ev.target.id;
    if (!ridingThis) return; // not riding it yet: let the normal mount interaction happen
    ev.cancel = true;
    const player = ev.player;
    system.run(() => fire(player));
  });
}
