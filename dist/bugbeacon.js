/*! @bugbeacon/browser v0.1.0 | MIT License | https://github.com/airshiplabs/bugbeacon-sdks */
"use strict";
var BugBeacon = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    defineBugBeacon: () => defineBugBeacon
  });

  // src/endpoint.ts
  function endpointOrigin(value, host) {
    try {
      const url = new URL(value);
      const localhostHttp = url.protocol === "http:" && url.hostname === "localhost" && host.hostname === "localhost";
      if (url.protocol !== "https:" && !localhostHttp || url.username || url.password || url.pathname !== "/" || url.search || url.hash || host.origin === "null")
        return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  // src/protocol.ts
  var protocolVersion = 1;
  var messageSource = "bugbeacon";
  var minFrameHeight = 100;
  var maxFrameHeight = 4096;
  var labelMax = 60;
  var defaultTheme = {
    accent: "#365fe8",
    colorScheme: "light",
    labels: {
      trigger: "Report Bug",
      title: "Report a bug",
      close: "Close",
      submit: "Send report"
    }
  };
  var accentPattern = /^#[0-9a-f]{6}$/i;
  function plainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    return value;
  }
  function validHeight(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= minFrameHeight && value <= maxFrameHeight;
  }
  function hasControlCharacter(value) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 31 || code === 127) return true;
    }
    return false;
  }
  function label(value, fallback) {
    if (value === null) return fallback;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > labelMax || hasControlCharacter(trimmed))
      return fallback;
    return trimmed;
  }
  function themeFromAttributes(read) {
    const accent = read("accent");
    const scheme = read("color-scheme");
    return {
      accent: accent !== null && accentPattern.test(accent.trim()) ? accent.trim().toLowerCase() : defaultTheme.accent,
      colorScheme: scheme === "light" || scheme === "dark" ? scheme : defaultTheme.colorScheme,
      labels: {
        trigger: label(read("label"), defaultTheme.labels.trigger),
        title: label(read("heading"), defaultTheme.labels.title),
        close: label(read("close-label"), defaultTheme.labels.close),
        submit: label(read("submit-label"), defaultTheme.labels.submit)
      }
    };
  }
  function embedSearch(parentOrigin) {
    return new URLSearchParams({ origin: parentOrigin, embed: "1" }).toString();
  }
  function embedUrl(serviceOrigin, projectId, parentOrigin) {
    return `${serviceOrigin}/embed/${encodeURIComponent(projectId)}?${embedSearch(parentOrigin)}`;
  }
  function legacyInitMessage() {
    return { type: "bugbeacon:init", version: 1 };
  }
  function handshakeMessage() {
    return { source: messageSource, protocol: protocolVersion, type: "handshake", embed: true };
  }
  function themeMessage(theme) {
    return {
      source: messageSource,
      protocol: protocolVersion,
      type: "theme",
      accent: theme.accent,
      colorScheme: theme.colorScheme,
      labels: { ...theme.labels }
    };
  }
  function isEmbedMessageSource(origin, source, expectedOrigin, frame) {
    return typeof frame === "object" && frame !== null && source === frame && origin === expectedOrigin && expectedOrigin.length > 0 && expectedOrigin !== "null";
  }
  function parseHostMessage(data) {
    const message = plainRecord(data);
    if (!message) return null;
    const keys = Object.keys(message);
    if (keys.length === 2 && message.version === 1) {
      if (message.type === "bugbeacon:ready") return { kind: "legacy-ready" };
      if (message.type === "bugbeacon:close") return { kind: "legacy-close" };
      return null;
    }
    if (message.source !== messageSource || message.protocol !== protocolVersion) return null;
    if (message.type === "ready" || message.type === "close-request" || message.type === "submitted") {
      return keys.length === 3 ? { kind: message.type } : null;
    }
    if (message.type === "resize" && keys.length === 4 && validHeight(message.height)) {
      return { kind: "resize", height: message.height };
    }
    return null;
  }

  // src/index.ts
  var projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var submittedStatus = "Report submitted.";
  var markup = `
  <style>
    :host {
      display: inline-block;
      --bb-accent: ${defaultTheme.accent};
      --bb-text: #182d45;
      --bb-surface: #fff;
      --bb-header-border: #e2e9f3;
      --bb-dialog-border: #d4deed;
      --bb-close-bg: #f1f6fc;
      --bb-muted: #53647b;
      --bb-backdrop: #182d4570;
      font: 14px/1.5 system-ui, sans-serif;
      color: var(--bb-text);
      color-scheme: light;
    }
    :host([color-scheme="dark"]) {
      --bb-text: #e7eef8;
      --bb-surface: #121a27;
      --bb-header-border: #2a3a52;
      --bb-dialog-border: #2a3a52;
      --bb-close-bg: #1c2838;
      --bb-muted: #a8b6c9;
      --bb-backdrop: #02060c99;
      color-scheme: dark;
    }
    *, *::before, *::after { box-sizing: border-box; }
    button { font: inherit; cursor: pointer; }
    .trigger { min-height: 44px; padding: 10px 18px; border: 1px solid var(--bb-accent); border-radius: 10px; background: var(--bb-accent); color: white; font-weight: 650; }
    .trigger:hover { filter: brightness(0.88); }
    button:focus-visible { outline: 3px solid #fa9767; outline-offset: 3px; }
    .trigger:disabled { cursor: not-allowed; opacity: .6; }
    dialog { padding: 0; width: min(560px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); border: 1px solid var(--bb-dialog-border); border-radius: 16px; background: var(--bb-surface); color: var(--bb-text); box-shadow: 0 24px 80px #182d4533; overflow: auto; }
    dialog::backdrop { background: var(--bb-backdrop); }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid var(--bb-header-border); }
    h2 { margin: 0; font-size: 16px; font-weight: 650; }
    .close { min-height: 44px; padding: 8px 12px; border: 1px solid var(--bb-dialog-border); border-radius: 8px; background: var(--bb-close-bg); color: var(--bb-text); }
    iframe { display: block; width: 100%; height: 320px; min-height: 100px; border: 0; background: var(--bb-surface); overflow: hidden; }
    .status { max-width: 28ch; margin: 8px 0 0; font-size: 12px; color: var(--bb-muted); }
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
      static observedAttributes = [
        "project-id",
        "endpoint",
        "accent",
        "color-scheme",
        "label",
        "heading",
        "submit-label",
        "close-label"
      ];
      trigger;
      dialog;
      closeButton;
      heading;
      status;
      iframe = null;
      origin = null;
      theme = defaultTheme;
      protocolReady = false;
      themeQueued = false;
      constructor() {
        super();
        const root = this.attachShadow({ mode: "open" });
        root.innerHTML = markup;
        this.trigger = root.querySelector(".trigger");
        this.dialog = root.querySelector("dialog");
        this.closeButton = root.querySelector(".close");
        this.heading = root.querySelector("h2");
        this.status = root.querySelector(".status");
      }
      connectedCallback() {
        this.trigger.addEventListener("click", this.open);
        this.closeButton.addEventListener("click", this.close);
        this.closeButton.addEventListener("keydown", this.reverseTab);
        this.dialog.addEventListener("cancel", this.cancel);
        this.dialog.addEventListener("close", this.afterClose);
        this.dialog.addEventListener("click", this.backdrop);
        this.configure();
      }
      disconnectedCallback() {
        this.close();
        this.trigger.removeEventListener("click", this.open);
        this.closeButton.removeEventListener("click", this.close);
        this.closeButton.removeEventListener("keydown", this.reverseTab);
        this.dialog.removeEventListener("cancel", this.cancel);
        this.dialog.removeEventListener("close", this.afterClose);
        this.dialog.removeEventListener("click", this.backdrop);
      }
      attributeChangedCallback(name) {
        if (!this.isConnected) return;
        if (name === "project-id" || name === "endpoint") {
          this.close();
          this.configure();
          return;
        }
        this.applyTheme();
        this.postTheme();
      }
      configure() {
        this.origin = endpointOrigin(this.getAttribute("endpoint") ?? "", window.location);
        const valid = this.origin !== null && projectIdPattern.test(this.getAttribute("project-id") ?? "");
        this.trigger.disabled = !valid;
        this.status.textContent = valid ? "" : "Bug reporting is unavailable. Check the widget configuration.";
        this.applyTheme();
      }
      applyTheme() {
        this.theme = themeFromAttributes((name) => this.getAttribute(name));
        this.trigger.textContent = this.theme.labels.trigger;
        this.heading.textContent = this.theme.labels.title;
        this.closeButton.textContent = this.theme.labels.close;
        if (this.iframe) this.iframe.title = this.theme.labels.title;
        this.style.setProperty("--bb-accent", this.theme.accent);
      }
      open = () => {
        if (this.dialog.open || this.trigger.disabled || !this.origin) return;
        const projectId = this.getAttribute("project-id");
        if (!projectId) return;
        if (this.status.textContent === submittedStatus) this.status.textContent = "";
        const iframe = this.ownerDocument.createElement("iframe");
        iframe.title = this.theme.labels.title;
        iframe.referrerPolicy = "no-referrer";
        iframe.setAttribute("scrolling", "no");
        this.iframe = iframe;
        window.addEventListener("message", this.receiveMessage);
        iframe.src = embedUrl(this.origin, projectId, window.location.origin);
        this.dialog.append(iframe);
        const guard = this.ownerDocument.createElement("span");
        guard.className = "focus-guard";
        guard.tabIndex = 0;
        guard.addEventListener("focus", () => this.closeButton.focus());
        this.dialog.append(guard);
        this.dialog.showModal();
        this.closeButton.focus();
      };
      postToFrame(message) {
        if (!this.origin || !this.iframe?.contentWindow) return;
        this.iframe.contentWindow.postMessage(message, this.origin);
      }
      postHandshake() {
        this.postToFrame(handshakeMessage());
      }
      postTheme() {
        if (!this.protocolReady || this.themeQueued) return;
        this.themeQueued = true;
        queueMicrotask(() => {
          this.themeQueued = false;
          if (!this.protocolReady) return;
          this.postToFrame(themeMessage(this.theme));
        });
      }
      receiveMessage = (event) => {
        if (!this.origin || !isEmbedMessageSource(
          event.origin,
          event.source,
          this.origin,
          this.iframe?.contentWindow ?? null
        ))
          return;
        const message = parseHostMessage(event.data);
        if (!message) return;
        if (message.kind === "legacy-ready") {
          this.postToFrame(legacyInitMessage());
        } else if (message.kind === "ready") {
          this.protocolReady = true;
          this.postHandshake();
          this.postTheme();
        } else if (message.kind === "legacy-close" || message.kind === "close-request") {
          this.close();
        } else if (message.kind === "resize" && this.iframe) {
          this.iframe.style.height = `${message.height}px`;
        } else if (message.kind === "submitted") {
          this.status.textContent = submittedStatus;
        }
      };
      cancel = (event) => {
        event.preventDefault();
        this.close();
      };
      backdrop = (event) => {
        if (event.target === this.dialog) this.close();
      };
      reverseTab = (event) => {
        if (event.key === "Tab" && event.shiftKey && this.iframe) {
          event.preventDefault();
          const iframe = this.iframe;
          window.requestAnimationFrame(() => {
            if (this.dialog.open && this.iframe === iframe) iframe.contentWindow?.focus();
          });
        }
      };
      close = () => {
        const wasOpen = this.dialog.open;
        if (wasOpen) this.dialog.close();
        this.releaseFrame();
        if (wasOpen && this.isConnected && !this.trigger.disabled) this.trigger.focus();
      };
      afterClose = () => {
        if (!this.dialog.open) this.releaseFrame();
      };
      releaseFrame() {
        window.removeEventListener("message", this.receiveMessage);
        this.iframe?.remove();
        this.iframe = null;
        this.protocolReady = false;
        this.themeQueued = false;
        this.dialog.querySelector(".focus-guard")?.remove();
      }
    }
    window.customElements.define("bug-beacon", BugBeaconElement);
  }

  // src/browser.ts
  defineBugBeacon();
  return __toCommonJS(browser_exports);
})();
