import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultTheme,
  embedSearch,
  embedUrl,
  handshakeMessage,
  isEmbedMessageSource,
  legacyInitMessage,
  maxFrameHeight,
  parseHostMessage,
  themeFromAttributes,
  themeMessage,
} from "../src/protocol.ts";

const frame = {};
const origin = "https://service.example";

describe("parseHostMessage", () => {
  it("accepts protocol 1 messages with exact keys", () => {
    assert.deepEqual(parseHostMessage({ source: "bugbeacon", protocol: 1, type: "ready" }), {
      kind: "ready",
    });
    assert.deepEqual(
      parseHostMessage({ source: "bugbeacon", protocol: 1, type: "close-request" }),
      {
        kind: "close-request",
      },
    );
    assert.deepEqual(parseHostMessage({ source: "bugbeacon", protocol: 1, type: "submitted" }), {
      kind: "submitted",
    });
    assert.deepEqual(
      parseHostMessage({ source: "bugbeacon", protocol: 1, type: "resize", height: 480 }),
      {
        kind: "resize",
        height: 480,
      },
    );
  });

  it("keeps the legacy version 1 messages", () => {
    assert.deepEqual(parseHostMessage({ type: "bugbeacon:ready", version: 1 }), {
      kind: "legacy-ready",
    });
    assert.deepEqual(parseHostMessage({ type: "bugbeacon:close", version: 1 }), {
      kind: "legacy-close",
    });
    assert.deepEqual(legacyInitMessage(), { type: "bugbeacon:init", version: 1 });
  });

  it("rejects extra fields, wrong versions, bad heights, and non-objects", () => {
    const rejected = [
      null,
      [],
      "ready",
      Object.create(null),
      { type: "bugbeacon:close", version: 1, secret: "no" },
      { type: "bugbeacon:close", version: 2 },
      { type: "bugbeacon:close", version: "1" },
      { source: "featurefountain", protocol: 1, type: "close-request" },
      { source: "bugbeacon", protocol: 2, type: "close-request" },
      { source: "bugbeacon", protocol: "1", type: "ready" },
      { source: "bugbeacon", protocol: 1, type: "ready", embed: true },
      { source: "bugbeacon", protocol: 1, type: "resize", height: 480, extra: 1 },
      { source: "bugbeacon", protocol: 1, type: "resize", height: 0 },
      { source: "bugbeacon", protocol: 1, type: "resize", height: maxFrameHeight + 1 },
      { source: "bugbeacon", protocol: 1, type: "resize", height: 1.5 },
      { source: "bugbeacon", protocol: 1, type: "resize", height: "480" },
      { source: "bugbeacon", protocol: 1, type: "theme" },
      { source: "bugbeacon", protocol: 1, type: "handshake" },
      { source: "bugbeacon", protocol: 1, type: "nope" },
    ];
    for (const value of rejected) assert.equal(parseHostMessage(value), null);
    assert.deepEqual(
      parseHostMessage({ source: "bugbeacon", protocol: 1, type: "resize", height: 1 }),
      {
        kind: "resize",
        height: 1,
      },
    );
    assert.deepEqual(
      parseHostMessage({
        source: "bugbeacon",
        protocol: 1,
        type: "resize",
        height: maxFrameHeight,
      }),
      { kind: "resize", height: maxFrameHeight },
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
