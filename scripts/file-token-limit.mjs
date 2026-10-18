#!/usr/bin/env node

// Blocks a commit when any staged file an agent might author is over
// 5,000 tokens. Tokens are bytes / 4, so the byte limit is 20,000.
// The check reads the staged blob, not the working tree.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TOKEN_LIMIT = 5000;
export const BYTE_LIMIT = TOKEN_LIMIT * 4;

// Files agents do not author. This is the only ignore list.
// Paths are repo-root relative with forward slashes, as git prints them.
// To allow a generated file through, add its path pattern here.
export const IGNORE_RULES = [
  // Lockfiles. This repo commits package-lock.json.
  /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb|Gemfile\.lock|Podfile\.lock|Cargo\.lock|composer\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|packages\.lock\.json|npm-shrinkwrap\.json|shrinkwrap\.json|go\.sum|pubspec\.lock|mix\.lock|flake\.lock|Package\.resolved)$/,

  // Build and codegen output. This repo tracks esbuild and tsc output in dist/.
  /(?:^|\/)(?:dist|build|out|coverage|\.next|playwright-report|test-results)\//,

  // Generated sources, including migration metadata. None are committed today.
  /(?:^|\/)[^/]+\.generated\.[^/]+$/,
  /(?:^|\/)[^/]+\.gen\.[^/]+$/,
  /(?:^|\/)generated\//,
  /(?:^|\/)migrations\/meta\//,
  /(?:^|\/)drizzle\/meta\//,

  // Minified bundles.
  /\.min\.(?:js|mjs|cjs|css)$/,

  // Vendored third-party trees.
  /(?:^|\/)(?:vendor|third_party|third-party)\//,

  // Images, fonts, audio, video, archives, and other binary assets.
  /\.(?:png|jpe?g|gif|webp|ico|avif|bmp|svg|woff2?|ttf|otf|eot|mp3|mp4|wav|ogg|webm|mov|avi|pdf|zip|gz|tgz|tar|bz2|7z|rar|wasm|bin|exe|dll|so|dylib)$/i,

  // Test snapshots and baseline images.
  /\.snap$/,
  /(?:^|\/)__snapshots__\//,
  /[-.]baseline\.(?:png|jpe?g|webp|gif)$/i,
];

export function isIgnoredPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return IGNORE_RULES.some((rule) => rule.test(normalized));
}

export function formatFailure(offenders) {
  const lines = offenders.map((file) => {
    const tokens = Math.ceil(file.bytes / 4);
    return `${file.path}: ${file.bytes} bytes, ~${tokens} tokens, limit ${TOKEN_LIMIT} tokens (${BYTE_LIMIT} bytes)`;
  });

  return [
    "File token limit: staged content is over 5,000 tokens (20,000 bytes).",
    "",
    ...lines,
    "",
    "Split the file by responsibility into smaller files, each under 5,000 tokens (20,000 bytes).",
    "- Code: move each component, class or group of related functions into its own module; move types, constants, schemas and helpers into sibling files; if callers import from the old path, turn it into a folder with an index file that re-exports, so imports don't change. Update imports, then run the typecheck, lint and tests.",
    "- Tests: split by describe block or feature into several test files, and move shared fixtures/helpers into a support file.",
    "- Docs and Markdown: split by top-level section into separate files and link them from a short index.",
    "- Data or config: split into several files loaded together, or move large data out of source.",
    "- Re-stage the new files and commit again. Don't bypass with --no-verify.",
    "- If the file really is generated or not authored by an agent, add its path to the ignore list in scripts/file-token-limit.mjs instead of splitting it.",
  ].join("\n");
}

function git(args, input) {
  return execFileSync("git", args, {
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function parseStaged(raw) {
  const text = raw.toString("utf8");
  if (text.length === 0) return [];

  const parts = text.split("\0");
  if (parts.at(-1) === "") parts.pop();

  const staged = [];
  let index = 0;
  while (index < parts.length) {
    const header = parts[index];
    index += 1;
    const match = header.match(/^:\d+ \d+ ([0-9a-f]{40,64}) ([0-9a-f]{40,64}) ([ACMRT]\d*)$/);
    if (!match) {
      throw new Error(`unexpected staged diff header: ${header}`);
    }
    const oid = match[2];
    const status = match[3];
    if (index >= parts.length) {
      throw new Error("staged diff ended before the file path");
    }
    let filePath = parts[index];
    index += 1;
    if (status.startsWith("R") || status.startsWith("C")) {
      if (index >= parts.length) {
        throw new Error("staged diff ended before the renamed file path");
      }
      filePath = parts[index];
      index += 1;
    }
    staged.push({ path: filePath, oid });
  }
  return staged;
}

function blobSizes(oids) {
  if (oids.length === 0) return [];
  const output = git(
    ["cat-file", "--batch-check=%(objectsize)"],
    oids.map((oid) => `${oid}\n`).join(""),
  )
    .toString("utf8")
    .trimEnd();
  if (output.length === 0) return [];
  return output.split("\n").map((line) => {
    if (!/^\d+$/.test(line)) {
      throw new Error(`could not read staged blob size: ${line}`);
    }
    return Number(line);
  });
}

// .gitattributes: linguist-generated, or -diff, means the file is not hand-written.
function attributeSkipped(filePaths) {
  const skipped = new Set();
  if (filePaths.length === 0) return skipped;

  const raw = git(["check-attr", "-z", "linguist-generated", "diff", "--", ...filePaths]);
  const parts = raw.toString("utf8").split("\0");
  if (parts.at(-1) === "") parts.pop();

  const byPath = new Map();
  for (let index = 0; index + 2 < parts.length; index += 3) {
    const filePath = parts[index];
    const attribute = parts[index + 1];
    const value = parts[index + 2];
    const current = byPath.get(filePath) ?? {};
    current[attribute] = value;
    byPath.set(filePath, current);
  }

  for (const [filePath, attributes] of byPath) {
    const generated = attributes["linguist-generated"];
    if (generated === "true" || generated === "set") skipped.add(filePath);
    if (attributes.diff === "unset") skipped.add(filePath);
  }
  return skipped;
}

export function findOffenders() {
  const staged = parseStaged(
    git(["diff", "--cached", "--raw", "-z", "--abbrev=40", "--diff-filter=ACMR"]),
  );
  const candidates = staged.filter((file) => !isIgnoredPath(file.path));
  const skipped = attributeSkipped(candidates.map((file) => file.path));
  const remaining = candidates.filter((file) => !skipped.has(file.path));
  const sizes = blobSizes(remaining.map((file) => file.oid));

  return remaining
    .map((file, index) => ({ path: file.path, bytes: sizes[index] }))
    .filter((file) => file.bytes > BYTE_LIMIT)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function main() {
  try {
    const offenders = findOffenders();
    if (offenders.length === 0) return;
    console.error(formatFailure(offenders));
    process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("file token limit check could not read the index.");
    console.error(message);
    process.exitCode = 1;
  }
}

if (isDirectRun()) main();
