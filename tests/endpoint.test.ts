import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { endpointOrigin } from "../src/endpoint.ts";

const page = { hostname: "app.example", origin: "https://app.example" };
const localhost = { hostname: "localhost", origin: "http://localhost:4100" };

describe("endpointOrigin", () => {
  it("requires https and returns the parsed origin", () => {
    assert.equal(endpointOrigin("https://bugbeacon.ai", page), "https://bugbeacon.ai");
    assert.equal(endpointOrigin("https://bugbeacon.ai:8443", page), "https://bugbeacon.ai:8443");
    assert.equal(endpointOrigin("http://evil.example", page), null);
    assert.equal(endpointOrigin("http://evil.example", localhost), null);
    assert.equal(endpointOrigin("http://127.0.0.1:3000", localhost), null);
    assert.equal(endpointOrigin("http://[::1]:3000", localhost), null);
    assert.equal(
      endpointOrigin("http://localhost:3000", {
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:4100",
      }),
      null,
    );
  });

  it("allows http only for localhost on both sides", () => {
    assert.equal(endpointOrigin("http://localhost:3000", localhost), "http://localhost:3000");
    assert.equal(endpointOrigin("http://localhost:3000/path", localhost), null);
    assert.equal(endpointOrigin("https://user:password@bugbeacon.ai", page), null);
    assert.equal(endpointOrigin("https://bugbeacon.ai?token=1", page), null);
    assert.equal(endpointOrigin("not a url", page), null);
    assert.equal(
      endpointOrigin("https://bugbeacon.ai", { hostname: "localhost", origin: "null" }),
      null,
    );
  });
});
