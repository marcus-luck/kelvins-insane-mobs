import { Dimension, Entity, GameMode, Vector3, world } from "@minecraft/server";

export const DIMENSIONS = ["overworld", "nether", "the_end"] as const;

/** Run `fn` for every loaded entity of `typeId` across all dimensions. */
export function forEachEntity(typeId: string, fn: (e: Entity) => void): void {
  for (const id of DIMENSIONS) {
    for (const e of world.getDimension(id).getEntities({ type: typeId })) {
      if (e.isValid) fn(e);
    }
  }
}

/** Marks an entity as processed once; returns true the first time only (survives save/load). */
export function firstTime(e: Entity, tag: string): boolean {
  if (e.hasTag(tag)) return false;
  e.addTag(tag);
  return true;
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

export function closestPlayer(dim: Dimension, location: Vector3, maxDistance: number, minDistance = 0) {
  return dim.getPlayers({ location, maxDistance, minDistance, closest: 1, excludeGameModes: [GameMode.Creative, GameMode.Spectator] })[0];
}

export function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function lengthXZ(v: Vector3): number {
  return Math.hypot(v.x, v.z);
}

/** Rotate a vector around the Y axis by `deg` degrees. */
export function rotateY(v: Vector3, deg: number): Vector3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}

/** Swallow errors from entities/blocks that unloaded between our check and our call. */
export function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    /* entity or chunk went away mid-tick; nothing to do */
  }
}
