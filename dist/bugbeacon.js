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
      static observedAttributes = ["project-id", "endpoint"];
      trigger;
      dialog;
      closeButton;
      status;
      iframe = null;
      origin = null;
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
      attributeChangedCallback() {
        if (this.isConnected) {
          this.close();
          this.configure();
        }
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
          this.iframe.contentWindow?.postMessage(
            { type: "bugbeacon:init", version: 1 },
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

  // src/browser.ts
  defineBugBeacon();
  return __toCommonJS(browser_exports);
})();
