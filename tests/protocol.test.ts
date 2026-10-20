import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  defaultTheme,
  embedSearch,
  embedUrl,
  handshakeMessage,
  isEmbedMessageSource,
  labelMax,
  legacyInitMessage,
  maxFrameHeight,
  minFrameHeight,
  parseHostMessage,
  protocolVersion,
  themeFromAttributes,
  themeMessage,
} from "../src/protocol.ts";

const vectors = JSON.parse(
  readFileSync(new URL("./fixtures/embed-protocol.json", import.meta.url), "utf8"),
) as {
  valid: { name: string; data: unknown; parsed: unknown }[];
  invalid: { name: string; data: unknown }[];
  wrongWindow: { origin: string; expectedOrigin: string; data: unknown };
  unknownProtocol: { data: unknown; fallback: unknown };
};

const frame = {};
const origin = "https://service.example";

describe("parseHostMessage", () => {
  it("accepts every valid vector and rejects every invalid vector", () => {
    for (const vector of vectors.valid) {
      assert.deepEqual(parseHostMessage(vector.data), vector.parsed, vector.name);
    }
    for (const vector of vectors.invalid) {
      assert.equal(parseHostMessage(vector.data), null, vector.name);
    }
    assert.equal(parseHostMessage(Object.create(null)), null);
    assert.deepEqual(legacyInitMessage(), { type: "bugbeacon:init", version: 1 });
  });

  it("ignores protocol 2 and still accepts the legacy fallback", () => {
    assert.equal(parseHostMessage(vectors.unknownProtocol.data), null);
    assert.deepEqual(parseHostMessage(vectors.unknownProtocol.fallback), { kind: "legacy-close" });
    assert.equal(
      vectors.invalid.some((vector) => vector.name === "protocol-2"),
      true,
    );
  });
});

describe("isEmbedMessageSource", () => {
  it("requires the iframe window and the configured origin", () => {
    assert.equal(isEmbedMessageSource(origin, frame, origin, frame), true);
    assert.equal(isEmbedMessageSource("https://attacker.example", frame, origin, frame), false);
    assert.equal(isEmbedMessageSource(origin, {}, origin, frame), false);
    assert.equal(isEmbedMessageSource(origin, frame, origin, null), false);
    assert.equal(isEmbedMessageSource("null", frame, "null", frame), false);
    assert.equal(isEmbedMessageSource("", frame, "", frame), false);
  });

  it("rejects a different window on the endpoint origin", () => {
    const otherWindow = {};
    const { origin: messageOrigin, expectedOrigin, data } = vectors.wrongWindow;
    assert.deepEqual(parseHostMessage(data), { kind: "close-request" });
    assert.equal(isEmbedMessageSource(messageOrigin, otherWindow, expectedOrigin, frame), false);
    assert.equal(isEmbedMessageSource(messageOrigin, frame, expectedOrigin, frame), true);
  });
});

describe("theme and embed url", () => {
  it("builds handshake and theme messages without putting theme in the url", () => {
    const theme = themeFromAttributes((name) => {
      const values: Record<string, string> = {
        accent: "#A1B2C3",
        "color-scheme": "dark",
        label: " Found a bug ",
        heading: "Tell us",
        "close-label": "Dismiss",
        "submit-label": "Send",
      };
      return values[name] ?? null;
    });
    assert.deepEqual(handshakeMessage(), {
      source: "bugbeacon",
      protocol: 1,
      type: "handshake",
      embed: true,
    });
    assert.deepEqual(themeMessage(theme), {
      source: "bugbeacon",
      protocol: 1,
      type: "theme",
      accent: "#a1b2c3",
      colorScheme: "dark",
      labels: { trigger: "Found a bug", title: "Tell us", close: "Dismiss", submit: "Send" },
    });
    const url = embedUrl(origin, "8ad69ca1-395f-4eca-8f64-c84225f00111", "https://host.example");
    assert.equal(
      url,
      `${origin}/embed/8ad69ca1-395f-4eca-8f64-c84225f00111?${embedSearch("https://host.example")}`,
    );
    assert.equal(embedSearch("https://host.example"), "origin=https%3A%2F%2Fhost.example&embed=1");
    assert.equal(url.includes("accent"), false);
    assert.equal(url.includes("theme"), false);
    assert.equal(
      embedUrl(origin, "a/b c", "https://host.example"),
      `${origin}/embed/a%2Fb%20c?origin=https%3A%2F%2Fhost.example&embed=1`,
    );
  });

  it("publishes the protocol constants from the built subpath", async () => {
    const published = await import("../dist/protocol.js");
    assert.equal(published.protocolVersion, protocolVersion);
    assert.equal(published.minFrameHeight, minFrameHeight);
    assert.equal(published.maxFrameHeight, maxFrameHeight);
    assert.equal(published.labelMax, labelMax);
    assert.equal(typeof published.parseHostMessage, "function");
    assert.equal(published.parseHostMessage(vectors.unknownProtocol.data), null);
  });

  it("falls back when theme attributes are invalid", () => {
    const theme = themeFromAttributes((name) => {
      const values: Record<string, string> = {
        accent: "red",
        "color-scheme": "blue",
        label: "",
        heading: "line\nbreak",
        "submit-label": "x".repeat(61),
      };
      return values[name] ?? null;
    });
    assert.deepEqual(theme, defaultTheme);
  });
});
