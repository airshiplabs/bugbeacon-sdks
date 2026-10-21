import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const fixture = new URL("../tests/fixtures/embed-protocol.json", import.meta.url);
const expectedPath = new URL("../tests/fixtures/embed-protocol.json.sha256", import.meta.url);
const digest = createHash("sha256").update(readFileSync(fixture)).digest("hex");
const expected = readFileSync(expectedPath, "utf8").trim();

if (digest !== expected) {
  console.error(`tests/fixtures/embed-protocol.json sha256 is ${digest}`);
  console.error(`committed hash is ${expected}`);
  console.error(
    "Update tests/fixtures/embed-protocol.json.sha256 when this fixture change is deliberate.",
  );
  process.exit(1);
}

console.log(`embed-protocol.json sha256 ${digest}`);
