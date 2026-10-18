#!/usr/bin/env node

// Installs the file-token-limit pre-commit hook into this clone.
// npm runs this from the prepare script. If a pre-commit hook already
// exists, the managed block is inserted or replaced and the rest is kept.

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BEGIN = "# BEGIN file-token-limit";
const END = "# END file-token-limit";

const BLOCK = `${BEGIN}
node scripts/file-token-limit.mjs || exit $?
${END}
`;

// Install into this clone's hooks directory. `git rev-parse --git-path hooks`
// follows core.hooksPath, which may point at a shared dispatcher. The hook
// for this repo belongs next to its git dir so a normal clone runs it.
function hooksDir() {
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return path.resolve(common, "hooks");
  } catch {
    return null;
  }
}

export function upsertHook(existing) {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`);
  if (pattern.test(existing)) return existing.replace(pattern, BLOCK);
  if (existing.length === 0) return `#!/bin/sh\n${BLOCK}`;
  return existing.endsWith("\n") ? existing + BLOCK : `${existing}\n${BLOCK}`;
}

function main() {
  const dir = hooksDir();
  if (!dir) return;

  mkdirSync(dir, { recursive: true });
  const hookPath = path.join(dir, "pre-commit");
  let existing = "";
  try {
    const current = readFileSync(hookPath);
    if (current.includes(0)) {
      console.error(`left ${hookPath} unchanged because it is not a text hook`);
      return;
    }
    existing = current.toString("utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  writeFileSync(hookPath, upsertHook(existing));
  chmodSync(hookPath, 0o755);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("install-git-hooks.mjs")) {
  main();
}
