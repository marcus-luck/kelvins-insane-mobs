// Bundles src/ into packs/BP/scripts/main.js (the game provides @minecraft/* at runtime).
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "packs/BP/scripts/main.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  external: ["@minecraft/server", "@minecraft/server-ui"],
  logLevel: "info",
});
