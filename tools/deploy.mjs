// Copies the packs into Minecraft Bedrock's development pack folders.
// Re-enter the world (or run /reload for script-only changes) to see updates.
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const candidates = [
  process.env.KIM_COM_MOJANG,
  join(process.env.APPDATA ?? "", "Minecraft Bedrock", "Users", "Shared", "games", "com.mojang"),
  join(process.env.LOCALAPPDATA ?? "", "Packages", "Microsoft.MinecraftUWP_8wekyb3d8bbwe", "LocalState", "games", "com.mojang"),
].filter(Boolean);

const comMojang = candidates.find((p) => existsSync(join(p, "development_behavior_packs")));
if (!comMojang) {
  console.error("Could not find com.mojang. Set KIM_COM_MOJANG to its path.");
  process.exit(1);
}

for (const [src, dir] of [
  ["packs/BP", "development_behavior_packs"],
  ["packs/RP", "development_resource_packs"],
]) {
  const dest = join(comMojang, dir, `kelvins_insane_mobs_${src.endsWith("BP") ? "BP" : "RP"}`);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log(`deployed ${src} -> ${dest}`);
}
