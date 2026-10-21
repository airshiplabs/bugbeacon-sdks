import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  defaultTheme,
  embedSearch,
  embedUrl,
  clampFrameHeight,
  handshakeMessage,
  isEmbedMessageSource,
  labelMax,
  maxFrameHeight,
  minFrameHeight,
  minWireHeight,
  parseHostMessage,
  protocolVersion,
  themeFromAttributes,
  themeMessage,
} from "../src/protocol.ts";

const vectors = JSON.parse(
  readFileSync(new URL("./fixtures/embed-protocol.json", import.meta.url), "utf8"),
) as {
  messages: {
    name: string;
    product: string;
    data: Record<string, unknown>;
    kind: string | null;
  }[];
  parent: {
    name: string;
    product: string;
    data: unknown;
    origin: string;
    parentOrigin: string;
    sourceIsParent: boolean;
    framed: boolean;
    hidesClose: boolean;
  }[];
};

function bugbeaconMessages() {
  return vectors.messages.filter((vector) => vector.product === "bugbeacon");
}

function parsedHostMessage(vector: { data: Record<string, unknown>; kind: string | null }) {
  if (vector.kind === "resize") return { kind: "resize", height: vector.data.height };
  if (vector.kind === "ready" || vector.kind === "close-request" || vector.kind === "submitted") {
    return { kind: vector.kind };
  }
  return null;
}

const frame = {};
const origin = "https://service.example";

describe("parseHostMessage", () => {
  it("follows the shipyard message vectors for bugbeacon", () => {
    const handshake = bugbeaconMessages().find((vector) => vector.kind === "handshake");
    const theme = bugbeaconMessages().find((vector) => vector.kind === "theme");
    assert.deepEqual(handshakeMessage(), handshake?.data);
    assert.deepEqual(themeMessage(defaultTheme), theme?.data);
    for (const vector of bugbeaconMessages()) {
      if (vector.kind === "handshake" || vector.kind === "theme") continue;
      assert.deepEqual(parseHostMessage(vector.data), parsedHostMessage(vector), vector.name);
    }
    for (const vector of vectors.messages.filter((item) => item.product !== "bugbeacon")) {
      assert.equal(parseHostMessage(vector.data), null, vector.name);
    }
    assert.equal(parseHostMessage(Object.create(null)), null);
    assert.equal(parseHostMessage({ type: "bugbeacon:close", version: 1 }), null);
    assert.equal(parseHostMessage({ type: "bugbeacon:ready", version: 1 }), null);
  });

  it("ignores protocol 2 and rejects 0.1.0 messages", () => {
    const protocolTwo = bugbeaconMessages().find((vector) => vector.name === "protocol 2");
    assert.equal(protocolTwo?.kind, null);
    assert.equal(parseHostMessage(protocolTwo?.data), null);
    assert.equal(parseHostMessage({ type: "bugbeacon:init", version: 1 }), null);
    const shortest = bugbeaconMessages().find((vector) => vector.name === "resize min height");
    assert.deepEqual(parseHostMessage(shortest?.data), { kind: "resize", height: minWireHeight });
    assert.equal(clampFrameHeight(minWireHeight), minFrameHeight);
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
    for (const vector of vectors.parent.filter((item) => item.product === "bugbeacon")) {
      const source = vector.sourceIsParent ? frame : otherWindow;
      const sameWindowAndOrigin =
        vector.sourceIsParent &&
        vector.origin === vector.parentOrigin &&
        vector.origin !== "null" &&
        vector.origin.length > 0;
      assert.equal(
        isEmbedMessageSource(vector.origin, source, vector.parentOrigin, frame),
        sameWindowAndOrigin,
        vector.name,
      );
    }
    const wrongWindow = vectors.parent.find((vector) => vector.name === "wrong window");
    assert.equal(wrongWindow?.sourceIsParent, false);
    assert.equal(wrongWindow?.hidesClose, false);
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
    assert.equal(clampFrameHeight(1), minFrameHeight);
    assert.equal(clampFrameHeight(99), 100);
    assert.equal(clampFrameHeight(480), 480);
    const published = await import("../dist/protocol.js");
    assert.equal(published.protocolVersion, protocolVersion);
    assert.equal(published.minWireHeight, minWireHeight);
    assert.equal(published.minFrameHeight, minFrameHeight);
    assert.equal(published.clampFrameHeight(1), 100);
    assert.equal(published.clampFrameHeight(99), 100);
    assert.equal(published.clampFrameHeight(480), 480);
    assert.equal(published.maxFrameHeight, maxFrameHeight);
    assert.equal(published.labelMax, labelMax);
    assert.equal(typeof published.parseHostMessage, "function");
    const protocolTwo = bugbeaconMessages().find((vector) => vector.name === "protocol 2");
    assert.equal(published.parseHostMessage(protocolTwo?.data), null);
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
