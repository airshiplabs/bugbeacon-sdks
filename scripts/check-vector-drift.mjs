import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const localPath = new URL("../tests/fixtures/embed-protocol.json", import.meta.url);
const remote =
  "repos/airshiplabs/shipyard/contents/packages/embed-protocol/vectors.json?ref=devin--hosted-form-embed-close-hide";

const local = readFileSync(localPath);
const downloaded = execFileSync("gh", ["api", "-H", "Accept: application/vnd.github.raw", remote], {
  encoding: "buffer",
  maxBuffer: 2 * 1024 * 1024,
});

if (Buffer.compare(local, downloaded) !== 0) {
  console.error(
    "tests/fixtures/embed-protocol.json is not byte-identical to shipyard packages/embed-protocol/vectors.json",
  );
  process.exit(1);
}

console.log("embed protocol vectors match shipyard packages/embed-protocol/vectors.json");
