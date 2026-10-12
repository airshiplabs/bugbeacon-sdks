/*! @bugbeacon/browser v0.2.0 | MIT License | https://github.com/airshiplabs/bugbeacon-sdks */

// src/context.ts
var MAX_PAGE_URL_LENGTH = 2048;
var MIN_VIEWPORT = 1;
var MAX_VIEWPORT = 1e4;
function buildPageUrl(location) {
  if (location.origin === "null") return void 0;
  const pageUrl = `${location.origin}${location.pathname}`;
  if (pageUrl.length > MAX_PAGE_URL_LENGTH) return void 0;
  return pageUrl;
}
function buildViewport(window2) {
  const width = Math.round(window2.innerWidth);
  const height = Math.round(window2.innerHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < MIN_VIEWPORT || width > MAX_VIEWPORT || height < MIN_VIEWPORT || height > MAX_VIEWPORT) {
    return void 0;
  }
  return `${width}x${height}`;
}
function buildInitContext(window2, metadata) {
  const pageUrl = buildPageUrl(window2.location);
  const viewport = buildViewport(window2);
  if (!pageUrl || !viewport) return void 0;
  const context = { pageUrl, viewport };
  if (metadata) context.metadata = metadata;
  return context;
}

// src/metadata.ts
var MAX_METADATA_KEYS = 20;
var MAX_KEY_LENGTH = 40;
var MAX_VALUE_LENGTH = 200;
var MAX_METADATA_BYTES = 4096;
function warnDropped(key, reason) {
  console.warn(`BugBeacon: dropped metadata key "${key}" because ${reason}.`);
}
function isPlainMetadataObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function sanitizeMetadata(input) {
  if (input === void 0 || input === null) return void 0;
  if (!isPlainMetadataObject(input)) {
    console.warn(
      "BugBeacon: metadata must be a flat object; ignoring the value."
    );
    return void 0;
  }
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(result).length >= MAX_METADATA_KEYS) {
      warnDropped(key, "only 20 keys are allowed");
      continue;
    }
    if (key.length > MAX_KEY_LENGTH) {
      warnDropped(key, "key names must be 40 characters or fewer");
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      warnDropped(key, "values must be strings, numbers, or booleans");
      continue;
    }
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      warnDropped(key, "string values must be 200 characters or fewer");
      continue;
    }
    const candidate = { ...result, [key]: value };
    if (JSON.stringify(candidate).length > MAX_METADATA_BYTES) {
      warnDropped(key, "metadata must fit within 4096 bytes as JSON");
      continue;
    }
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function parseMetadataAttribute(raw) {
  if (!raw) return void 0;
  try {
    return sanitizeMetadata(JSON.parse(raw));
  } catch {
    console.warn("BugBeacon: metadata attribute must be valid JSON.");
    return void 0;
  }
}

// src/index.ts
var projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isLoopback(hostname) {
  return hostname === "localhost" || hostname === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}
function endpointOrigin(value, host) {
  try {
    const url = new URL(value);
    const local = url.protocol === "http:" && isLoopback(url.hostname) && isLoopback(host.hostname);
    if (url.protocol !== "https:" && !local || url.username || url.password || url.pathname !== "/" || url.search || url.hash || host.origin === "null")
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
var markup = `
  <style>
    :host { display: inline-block; font: 14px/1.5 system-ui, sans-serif; color: #182d45; }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; cursor: pointer; }
    .trigger { min-height: 44px; padding: 10px 18px; border: 1px solid #365fe8; border-radius: 10px; background: #365fe8; color: white; font-weight: 650; }
    .trigger:hover { background: #294dcc; }
    button:focus-visible { outline: 3px solid #fa9767; outline-offset: 3px; }
    .trigger:disabled { cursor: not-allowed; opacity: .6; }
    dialog { padding: 0; width: min(560px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); border: 1px solid #d4deed; border-radius: 16px; background: #fff; color: #182d45; box-shadow: 0 24px 80px #182d4533; overflow: hidden; }
    dialog::backdrop { background: #182d4570; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid #e2e9f3; }
    h2 { margin: 0; font-size: 16px; font-weight: 650; }
    .close { min-height: 44px; padding: 8px 12px; border: 1px solid #d4deed; border-radius: 8px; background: #f1f6fc; color: #182d45; }
    iframe { display: block; width: 100%; height: min(620px, calc(100dvh - 104px)); min-height: 100px; border: 0; background: #fff; }
    .status { max-width: 28ch; margin: 8px 0 0; font-size: 12px; color: #53647b; }
    .status:empty { display: none; }
    .focus-guard { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
  </style>
  <button class="trigger" type="button" aria-haspopup="dialog">Report Bug</button>
  <p class="status" role="status"></p>
  <dialog aria-labelledby="bugbeacon-heading">
    <div class="header">
      <h2 id="bugbeacon-heading">Report a bug</h2>
      <button class="close" type="button" autofocus>Close</button>
    </div>
  </dialog>
`;
function defineBugBeacon() {
  if (typeof window === "undefined" || !window.customElements || window.customElements.get("bug-beacon"))
    return;
  class BugBeaconElement extends HTMLElement {
    static observedAttributes = ["project-id", "endpoint", "metadata"];
    trigger;
    dialog;
    closeButton;
    status;
    iframe = null;
    origin = null;
    metadataFromProperty = false;
    metadataProperty;
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = markup;
      this.trigger = root.querySelector(".trigger");
      this.dialog = root.querySelector("dialog");
      this.closeButton = root.querySelector(".close");
      this.status = root.querySelector(".status");
    }
    connectedCallback() {
      this.trigger.addEventListener("click", this.open);
      this.closeButton.addEventListener("click", this.close);
      this.closeButton.addEventListener("keydown", this.reverseTab);
      this.dialog.addEventListener("cancel", this.cancel);
      this.dialog.addEventListener("close", this.afterClose);
      this.configure();
    }
    disconnectedCallback() {
      this.close();
      this.trigger.removeEventListener("click", this.open);
      this.closeButton.removeEventListener("click", this.close);
      this.closeButton.removeEventListener("keydown", this.reverseTab);
      this.dialog.removeEventListener("cancel", this.cancel);
      this.dialog.removeEventListener("close", this.afterClose);
    }
    get metadata() {
      return this.metadataProperty;
    }
    set metadata(value) {
      this.metadataFromProperty = true;
      this.metadataProperty = value === void 0 ? void 0 : sanitizeMetadata(value);
    }
    attributeChangedCallback(name) {
      if (!this.isConnected) return;
      if (name === "metadata") return;
      this.close();
      this.configure();
    }
    resolvedMetadata() {
      if (this.metadataFromProperty) return this.metadataProperty;
      return parseMetadataAttribute(this.getAttribute("metadata"));
    }
    configure() {
      this.origin = endpointOrigin(
        this.getAttribute("endpoint") ?? "",
        window.location
      );
      const valid = this.origin !== null && projectIdPattern.test(this.getAttribute("project-id") ?? "");
      this.trigger.disabled = !valid;
      this.status.textContent = valid ? "" : "Bug reporting is unavailable. Check the widget configuration.";
    }
    open = () => {
      if (this.dialog.open || this.trigger.disabled || !this.origin) return;
      const iframe = this.ownerDocument.createElement("iframe");
      iframe.title = "Report a bug";
      iframe.referrerPolicy = "no-referrer";
      this.iframe = iframe;
      window.addEventListener("message", this.receiveMessage);
      iframe.src = `${this.origin}/embed/${this.getAttribute("project-id")}?origin=${encodeURIComponent(window.location.origin)}`;
      this.dialog.append(iframe);
      const guard = this.ownerDocument.createElement("span");
      guard.className = "focus-guard";
      guard.tabIndex = 0;
      guard.addEventListener("focus", () => this.closeButton.focus());
      this.dialog.append(guard);
      this.dialog.showModal();
      this.closeButton.focus();
    };
    receiveMessage = (event) => {
      if (!this.iframe || !this.origin || event.source !== this.iframe.contentWindow || event.origin !== this.origin)
        return;
      const data = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const message = data;
      if (Object.keys(message).length !== 2 || message.version !== 1) return;
      if (message.type === "bugbeacon:ready") {
        const context = buildInitContext(window, this.resolvedMetadata());
        this.iframe.contentWindow?.postMessage(
          context ? { type: "bugbeacon:init", version: 2, context } : { type: "bugbeacon:init", version: 1 },
          this.origin
        );
      } else if (message.type === "bugbeacon:close") {
        this.close();
      }
    };
    cancel = (event) => {
      event.preventDefault();
      this.close();
    };
    reverseTab = (event) => {
      if (event.key === "Tab" && event.shiftKey && this.iframe) {
        event.preventDefault();
        const iframe = this.iframe;
        window.requestAnimationFrame(() => {
          if (this.dialog.open && this.iframe === iframe)
            iframe.contentWindow?.focus();
        });
      }
    };
    close = () => {
      const wasOpen = this.dialog.open;
      if (wasOpen) this.dialog.close();
      this.releaseFrame();
      if (wasOpen && this.isConnected && !this.trigger.disabled)
        this.trigger.focus();
    };
    afterClose = () => {
      if (!this.dialog.open) this.releaseFrame();
    };
    releaseFrame() {
      window.removeEventListener("message", this.receiveMessage);
      this.iframe?.remove();
      this.iframe = null;
      this.dialog.querySelector(".focus-guard")?.remove();
    }
  }
  window.customElements.define("bug-beacon", BugBeaconElement);
}
export {
  defineBugBeacon
};
