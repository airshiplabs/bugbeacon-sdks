import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const projectId = "8ad69ca1-395f-4eca-8f64-c84225f00111";
const serviceOrigin = "https://service.example";
const hostOrigin = "https://host.example";
const bundle = await readFile(new URL("../dist/bugbeacon.js", import.meta.url), "utf8");

function embedDocument(host: string, mode: "legacy" | "protocol"): string {
  const target = JSON.stringify(host);
  if (mode === "protocol") {
    return `<!doctype html><html><body><label>Title<input></label><button id="hosted-close">Close</button><button id="close">Done</button><button id="send">Send</button><script>
      window.addEventListener('message', event => {
        if (event.origin === ${target} && event.source === parent) {
          window.recordMessage(event.data);
          if (event.data && event.data.type === 'handshake' && event.data.embed === true) {
            document.body.dataset.initialized = 'true';
            document.querySelector('#hosted-close').hidden = true;
          }
        }
      });
      parent.postMessage({ source: 'bugbeacon', protocol: 1, type: 'ready' }, ${target});
      parent.postMessage({ source: 'bugbeacon', protocol: 1, type: 'resize', height: 480 }, ${target});
      document.querySelector('#close').onclick = () => parent.postMessage({ source: 'bugbeacon', protocol: 1, type: 'close-request' }, ${target});
      document.querySelector('#send').onclick = () => parent.postMessage({ source: 'bugbeacon', protocol: 1, type: 'submitted' }, ${target});
    </script></body></html>`;
  }
  return `<!doctype html><html><body><label>Title<input></label><button id="close">Done</button><script>
    window.addEventListener('message', event => {
      if (event.origin === ${target} && event.source === parent) {
        window.recordMessage(event.data);
        document.body.dataset.initialized = String(event.data.type === 'bugbeacon:init');
      }
    });
    parent.postMessage({ type: 'bugbeacon:ready', version: 1 }, ${target});
    document.querySelector('#close').onclick = () => parent.postMessage({ type: 'bugbeacon:close', version: 1 }, ${target});
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') parent.postMessage({ type: 'bugbeacon:close', version: 1 }, ${target});
    });
  </script></body></html>`;
}

async function mount(
  page: Page,
  options: {
    endpoint?: string;
    host?: string;
    count?: number;
    mode?: "legacy" | "protocol";
    embed?: "load" | "abort";
    attributes?: string;
  } = {},
) {
  const host = options.host ?? hostOrigin;
  const endpoint = options.endpoint ?? serviceOrigin;
  const mode = options.mode ?? "legacy";
  const attributes = options.attributes ?? "";
  const messages: unknown[] = [];
  const requests: { url: string; referer?: string }[] = [];
  await page.exposeFunction("recordMessage", (data: unknown) => messages.push(data));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/embed/")) {
      requests.push({ url: request.url(), referer: request.headers().referer });
      if (options.embed === "abort") {
        await route.abort();
        return;
      }
      await route.fulfill({
        contentType: "text/html",
        body: embedDocument(host, mode),
      });
    } else {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body><button>Before widget</button>${Array.from({ length: options.count ?? 1 }, () => `<bug-beacon project-id="${projectId}" endpoint="${endpoint}" ${attributes}></bug-beacon>`).join("")}<button>After widget</button></body></html>`,
      });
    }
  });
  await page.goto(`${host}/private/path?session=do-not-send#private-fragment`);
  await page.addScriptTag({ content: bundle });
  return { messages, requests };
}

test("ESM import and registration are safe without a browser", async () => {
  const { defineBugBeacon } = await import("../dist/index.js");
  expect(() => defineBugBeacon()).not.toThrow();
});

test("plain script registers once and embeds only the project and parent origin", async ({
  page,
}) => {
  const { requests, messages } = await mount(page);
  await page.evaluate(() => {
    const { BugBeacon } = window as unknown as {
      BugBeacon: { defineBugBeacon(): void };
    };
    BugBeacon.defineBugBeacon();
    BugBeacon.defineBugBeacon();
  });
  await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toHaveCount(1);
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  expect(requests).toEqual([
    {
      url: `${serviceOrigin}/embed/${projectId}?origin=${encodeURIComponent(hostOrigin)}&embed=1`,
      referer: undefined,
    },
  ]);
  expect(messages).toEqual([{ type: "bugbeacon:init", version: 1 }]);
  await expect(page.locator("iframe")).toHaveAttribute("title", "Report a bug");
});

test("Close, Escape, and reporter closure restore keyboard focus", async ({ page }) => {
  await mount(page);
  const trigger = page.getByRole("button", { name: "Report Bug", exact: true });
  const dialog = page.getByRole("dialog");
  await trigger.click();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.frameLocator("iframe").getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("forged source, origin, protocol, and extra fields cannot close the dialog", async ({
  page,
}) => {
  await mount(page);
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await page.evaluate((origin) => {
    const source = document
      .querySelector("bug-beacon")!
      .shadowRoot!.querySelector("iframe")!.contentWindow;
    const candidates = [
      { origin, source: window, data: { type: "bugbeacon:close", version: 1 } },
      {
        origin: "https://attacker.example",
        source,
        data: { type: "bugbeacon:close", version: 1 },
      },
      { origin, source, data: { type: "bugbeacon:close", version: 2 } },
      {
        origin,
        source,
        data: { type: "bugbeacon:close", version: 1, secret: "unexpected" },
      },
      { origin, source, data: { type: "close", version: 1 } },
      { origin, source, data: null },
    ];
    for (const { source, ...init } of candidates) {
      const event = new MessageEvent("message", init);
      // Firefox rejects cross-origin sources passed to the MessageEvent constructor.
      Object.defineProperty(event, "source", { value: source });
      window.dispatchEvent(event);
    }
  }, serviceOrigin);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.frameLocator("iframe").getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("removal and reinsertion release the modal and retain one working listener", async ({
  page,
}) => {
  const { messages } = await mount(page);
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await page.evaluate(() => {
    const widget = document.querySelector("bug-beacon")!;
    widget.remove();
    document.body.append(widget);
  });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  expect(messages).toHaveLength(2);
});

test("multiple widgets accept messages only from their own frames", async ({ page }) => {
  await mount(page, { count: 2 });
  await page.getByRole("button", { name: "Report Bug", exact: true }).nth(1).click();
  await expect(page.locator("bug-beacon").nth(0).locator("dialog")).not.toBeVisible();
  await expect(page.locator("bug-beacon").nth(1).locator("dialog")).toBeVisible();
  await page
    .locator("bug-beacon")
    .nth(1)
    .frameLocator("iframe")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Report Bug", exact: true }).nth(1)).toBeFocused();
});

for (const endpoint of [
  "http://service.example",
  "https://user:password@service.example",
  "https://service.example/path",
  "https://service.example?token=secret",
  "https://service.example#fragment",
  "javascript:alert(1)",
  "http://localhost:3000",
]) {
  test(`rejects invalid endpoint ${endpoint}`, async ({ page }) => {
    const { requests } = await mount(page, { endpoint });
    await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("unavailable");
    expect(requests).toHaveLength(0);
  });
}

test("loopback development allows a loopback HTTP service", async ({ page }) => {
  const { requests } = await mount(page, {
    host: "http://localhost:4100",
    endpoint: "http://127.0.0.1:4200",
  });
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  expect(requests[0].url).toBe(
    `http://127.0.0.1:4200/embed/${projectId}?origin=http%3A%2F%2Flocalhost%3A4100&embed=1`,
  );
});

test("invalid project IDs never navigate and attribute corrections recover", async ({ page }) => {
  await mount(page);
  await page
    .locator("bug-beacon")
    .evaluate((widget) => widget.setAttribute("project-id", "../../admin"));
  await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toBeDisabled();
  await page
    .locator("bug-beacon")
    .evaluate((widget, id) => widget.setAttribute("project-id", id), projectId);
  await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toBeEnabled();
});

test("keyboard focus stays within the dialog and Escape works from the iframe", async ({
  page,
}) => {
  await mount(page);
  await expect(page.getByRole("button", { name: "Report Bug", exact: true })).not.toBeFocused();
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  const focusStates: string[] = [];
  const inputStates: boolean[] = [];
  for (let tab = 0; tab < 6; tab++) {
    await page.keyboard.press("Tab");
    focusStates.push(
      await page
        .locator("bug-beacon")
        .evaluate((widget) =>
          document.activeElement === widget ? widget.shadowRoot!.activeElement!.tagName : "outside",
        ),
    );
    inputStates.push(
      await page
        .frameLocator("iframe")
        .getByRole("textbox")
        .evaluate((input) => document.activeElement === input),
    );
  }
  expect(focusStates).not.toContain("outside");
  expect(focusStates).toContain("IFRAME");
  expect(focusStates).toContain("BUTTON");
  expect(inputStates).toContain(true);
  await page.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("iframe")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Report Bug", exact: true })).toBeFocused();
});

test("configuration changes close the old form and reopen at the new endpoint", async ({
  page,
}) => {
  const { requests } = await mount(page);
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await page
    .locator("bug-beacon")
    .evaluate((widget) => widget.setAttribute("endpoint", "https://replacement.example"));
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  expect(new URL(requests[1].url).origin).toBe("https://replacement.example");
});

test("protocol handshake hides the hosted close, themes, and resizes", async ({ page }) => {
  const { messages, requests } = await mount(page, {
    mode: "protocol",
    attributes:
      'accent="#A1B2C3" color-scheme="dark" label="Found a bug" heading="Tell us" close-label="Dismiss" submit-label="Send it"',
  });
  const trigger = page.getByRole("button", { name: "Found a bug", exact: true });
  await trigger.click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect(
    page.frameLocator("iframe").getByRole("button", { name: "Close", exact: true }),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Tell us" })).toBeVisible();
  expect(requests[0]?.url).toContain("embed=1");
  expect(requests[0]?.url).not.toContain("accent");
  expect(requests[0]?.url).not.toContain("color-scheme");
  await expect
    .poll(() => messages)
    .toEqual([
      { source: "bugbeacon", protocol: 1, type: "handshake", embed: true },
      {
        source: "bugbeacon",
        protocol: 1,
        type: "theme",
        accent: "#a1b2c3",
        colorScheme: "dark",
        labels: { trigger: "Found a bug", title: "Tell us", close: "Dismiss", submit: "Send it" },
      },
    ]);
  await expect(page.locator("iframe")).toHaveJSProperty("style.height", "480px");
  const surface = await page.locator("bug-beacon").evaluate((widget) => {
    const dialog = widget.shadowRoot!.querySelector("dialog")!;
    return getComputedStyle(dialog).backgroundColor;
  });
  expect(surface).toBe("rgb(18, 26, 39)");
});

test("theme updates after ready are sent again and invalid accents stay default", async ({
  page,
}) => {
  const { messages } = await mount(page, { mode: "protocol", attributes: 'accent="red"' });
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  expect(messages[1]).toMatchObject({ type: "theme", accent: "#365fe8", colorScheme: "light" });
  await page.locator("bug-beacon").evaluate((widget) => {
    widget.setAttribute("accent", "#112233");
    widget.setAttribute("color-scheme", "dark");
  });
  await expect.poll(() => messages.length).toBe(3);
  expect(messages[2]).toMatchObject({
    type: "theme",
    accent: "#112233",
    colorScheme: "dark",
  });
});

test("close-request closes and submitted leaves the dialog open", async ({ page }) => {
  await mount(page, { mode: "protocol" });
  const trigger = page.getByRole("button", { name: "Report Bug", exact: true });
  await trigger.click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await page.frameLocator("iframe").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Report submitted.");
  await page.frameLocator("iframe").getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("forged protocol messages cannot close or resize", async ({ page }) => {
  await mount(page, { mode: "protocol" });
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect(page.locator("iframe")).toHaveJSProperty("style.height", "480px");
  await page.evaluate((service) => {
    const source = document
      .querySelector("bug-beacon")!
      .shadowRoot!.querySelector("iframe")!.contentWindow;
    const candidates = [
      {
        origin: service,
        source: window,
        data: { source: "bugbeacon", protocol: 1, type: "close-request" },
      },
      {
        origin: "https://attacker.example",
        source,
        data: { source: "bugbeacon", protocol: 1, type: "close-request" },
      },
      {
        origin: service,
        source,
        data: { source: "bugbeacon", protocol: 2, type: "close-request" },
      },
      {
        origin: service,
        source,
        data: { source: "bugbeacon", protocol: 1, type: "close-request", extra: true },
      },
      {
        origin: "https://attacker.example",
        source,
        data: { source: "bugbeacon", protocol: 1, type: "resize", height: 120 },
      },
      {
        origin: service,
        source,
        data: { source: "bugbeacon", protocol: 1, type: "resize", height: 120, extra: true },
      },
      { origin: "null", source, data: { source: "bugbeacon", protocol: 1, type: "close-request" } },
    ];
    for (const { source: frame, ...init } of candidates) {
      const event = new MessageEvent("message", init);
      Object.defineProperty(event, "source", { value: frame });
      window.dispatchEvent(event);
    }
  }, serviceOrigin);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("iframe")).toHaveJSProperty("style.height", "480px");
});

test("dialog closes from the shell when the iframe never loads", async ({ page }) => {
  await mount(page, { embed: "abort" });
  const trigger = page.getByRole("button", { name: "Report Bug", exact: true });
  const dialog = page.getByRole("dialog");
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("mobile dialog keeps Close visible without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mount(page);
  await page.getByRole("button", { name: "Report Bug", exact: true }).click();
  const close = await page.getByRole("button", { name: "Close", exact: true }).boundingBox();
  expect(close).not.toBeNull();
  expect(close!.x).toBeGreaterThanOrEqual(0);
  expect(close!.x + close!.width).toBeLessThanOrEqual(320);
  expect(close!.y + close!.height).toBeLessThanOrEqual(568);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
