import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { BYTE_LIMIT } from "./file-token-limit.mjs";
import { upsertHook } from "./install-git-hooks.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "file-token-limit.mjs");

function git(cwd, args, input) {
  return execFileSync("git", args, { cwd, input, encoding: "utf8" });
}

function runCheck(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

async function makeRepo() {
  const cwd = await mkdtemp(path.join(tmpdir(), "file-token-limit-"));
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "token-limit@example.com"]);
  git(cwd, ["config", "user.name", "Token Limit Test"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  await writeFile(path.join(cwd, "README.md"), "ok\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-m", "init"]);
  return cwd;
}

async function withRepo(fn) {
  const cwd = await makeRepo();
  try {
    await fn(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function stageBytes(cwd, filePath, bytes) {
  const fullPath = path.join(cwd, filePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.alloc(bytes, 0x61));
  git(cwd, ["add", "--", filePath]);
}

test("a staged file over the limit fails", async () => {
  await withRepo(async (cwd) => {
    await stageBytes(cwd, "src/big.ts", BYTE_LIMIT + 1);
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /src\/big\.ts: 20001 bytes, ~5001 tokens/);
    assert.match(result.stderr, /limit 5000 tokens \(20000 bytes\)/);
    assert.match(result.stderr, /turn it into a folder with an index file that re-exports/);
    assert.match(result.stderr, /Don't bypass with --no-verify/);
    assert.match(
      result.stderr,
      /add its path to the ignore list in scripts\/file-token-limit\.mjs/,
    );
  });
});

test("a staged file at the limit passes", async () => {
  await withRepo(async (cwd) => {
    await stageBytes(cwd, "src/ok.ts", BYTE_LIMIT);
    const result = runCheck(cwd);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("an ignored lockfile over the limit passes", async () => {
  await withRepo(async (cwd) => {
    await stageBytes(cwd, "package-lock.json", BYTE_LIMIT + 5000);
    const result = runCheck(cwd);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("a deletion passes", async () => {
  await withRepo(async (cwd) => {
    await stageBytes(cwd, "src/big.ts", BYTE_LIMIT + 5000);
    git(cwd, ["commit", "-m", "add big file"]);
    git(cwd, ["rm", "src/big.ts"]);
    const result = runCheck(cwd);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("build output and gitattributes are ignored", async () => {
  await withRepo(async (cwd) => {
    await mkdir(path.join(cwd, "dist"), { recursive: true });
    await stageBytes(cwd, "dist/bundle.js", BYTE_LIMIT + 100);
    await stageBytes(cwd, "generated.js", BYTE_LIMIT + 100);
    await writeFile(
      path.join(cwd, ".gitattributes"),
      "generated.js linguist-generated=true\n*.min.js -diff\n",
    );
    git(cwd, ["add", ".gitattributes"]);
    await stageBytes(cwd, "app.min.js", BYTE_LIMIT + 100);
    const result = runCheck(cwd);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("only the staged blob counts", async () => {
  await withRepo(async (cwd) => {
    const small = Buffer.alloc(100, 0x62);
    const hash = git(cwd, ["hash-object", "-w", "--stdin"], small).trim();
    git(cwd, ["update-index", "--add", "--cacheinfo", `100644,${hash},partial.ts`]);
    await writeFile(path.join(cwd, "partial.ts"), Buffer.alloc(BYTE_LIMIT + 100, 0x63));
    const under = runCheck(cwd);
    assert.equal(under.status, 0, under.stderr);

    const big = Buffer.alloc(BYTE_LIMIT + 1, 0x64);
    const bigHash = git(cwd, ["hash-object", "-w", "--stdin"], big).trim();
    git(cwd, ["update-index", "--add", "--cacheinfo", `100644,${bigHash},partial.ts`]);
    await writeFile(path.join(cwd, "partial.ts"), "small working tree\n");
    const over = runCheck(cwd);
    assert.equal(over.status, 1);
    assert.match(over.stderr, /partial\.ts: 20001 bytes/);
  });
});

test("the installer keeps an existing hook and stays idempotent", () => {
  const existing = "#!/bin/sh\necho other-hook\n";
  const once = upsertHook(existing);
  const twice = upsertHook(once);
  assert.equal(twice, once);
  assert.match(once, /echo other-hook/);
  assert.match(once, /node scripts\/file-token-limit\.mjs/);
  assert.equal(once.match(/BEGIN file-token-limit/g).length, 1);
});
