import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const { name, version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const shared = {
  bundle: true,
  target: "es2022",
  legalComments: "inline",
  banner: {
    js: `/*! ${name} v${version} | MIT License | https://github.com/airshiplabs/bugbeacon-sdks */`,
  },
};

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  format: "esm",
});
await build({
  ...shared,
  entryPoints: ["src/browser.ts"],
  outfile: "dist/bugbeacon.js",
  format: "iife",
  globalName: "BugBeacon",
});
