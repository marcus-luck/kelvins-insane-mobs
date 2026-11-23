# Kelvin's Insane Mobs

Minecraft Bedrock Add-On (behavior pack + resource pack). Stable Script API only, so no experiments are needed.

## What's in it
| Mob | Insanity |
|---|---|
| Zombie | Permanent Speed, lunges at you from 2.5–7 blocks, 25% chance to split into 2 baby zombies on death |
| Creeper | 10% spawn charged; sometimes teleports right behind you |
| Skeleton / Stray / Bogged | Every shot is a 3-arrow volley |
| Spider / Cave Spider | Bites can web you in place for 5 s |
| **Gazer** (new) | Floating eyeball that fires homing shulker bullets (levitation). Spawns at night, burns in daylight |
| **Flappy Ghast** (new) | Pink/blue rideable ghast with flapping wings. Right-click a **Fire Charge** while riding to shoot fireballs. Hold forward and fly straight to boost up to 7x speed. Rare in plains, or use the spawn egg |
| **Enderpig** (new) | Friendly black pig on stilts. Teleports like an enderman, hates water, dodges arrows. Stare at it and it teleports to you. Spawns rarely in the overworld, often in the End |

## Develop
```
npm install
npm run deploy     # build TS -> packs/BP/scripts, copy packs into Minecraft's dev folders
npm run art        # regenerate textures/icons from art/generate.py
npm run typecheck
```
Test world: create a world, then under Behavior Packs activate **Kelvin's Insane Mobs** (the resource pack comes with it).
After a deploy, leave and re-enter the world. For script-only changes, `/reload` is enough.
Summon new mobs with `/summon kim:gazer`, `kim:flappy_ghast`, `kim:enderpig`, or use their spawn eggs.

## Layout
- `src/` TypeScript for the vanilla mob behaviors (one file per mob in `src/mobs/`)
- `packs/BP` behavior pack: entities, spawn rules, loot, plus the built script
- `packs/RP` resource pack: models, animations, textures, lang
- `art/generate.py` procedural pixel art for the textures
