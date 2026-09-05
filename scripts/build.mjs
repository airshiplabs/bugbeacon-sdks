import { build } from "esbuild";

const shared = {
  bundle: true,
  target: "es2022",
  legalComments: "inline",
  banner: {
    js: "/*! @bugbeacon/widget v0.0.0 | MIT License | https://github.com/airshiplabs/bugbeacon-widget */",
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
