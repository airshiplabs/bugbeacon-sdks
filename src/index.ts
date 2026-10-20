import {
  defaultTheme,
  embedUrl,
  handshakeMessage,
  isEmbedMessageSource,
  legacyInitMessage,
  parseHostMessage,
  themeFromAttributes,
  themeMessage,
  type Theme,
} from "./protocol";

const projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const submittedStatus = "Report submitted.";

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

function endpointOrigin(value: string, host: Location): string | null {
  try {
    const url = new URL(value);
    const local = url.protocol === "http:" && isLoopback(url.hostname) && isLoopback(host.hostname);
    if (
      (url.protocol !== "https:" && !local) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      host.origin === "null"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

const markup = `
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

/** Register the <bug-beacon> element. Calling this during server rendering does nothing. */
export function defineBugBeacon(): void {
  if (
    typeof window === "undefined" ||
    !window.customElements ||
    window.customElements.get("bug-beacon")
  )
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
      "close-label",
    ];
    private readonly trigger: HTMLButtonElement;
    private readonly dialog: HTMLDialogElement;
    private readonly closeButton: HTMLButtonElement;
    private readonly heading: HTMLHeadingElement;
    private readonly status: HTMLParagraphElement;
    private iframe: HTMLIFrameElement | null = null;
    private origin: string | null = null;
    private theme: Theme = defaultTheme;
    private protocolReady = false;
    private themeQueued = false;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = markup;
      this.trigger = root.querySelector(".trigger")!;
      this.dialog = root.querySelector("dialog")!;
      this.closeButton = root.querySelector(".close")!;
      this.heading = root.querySelector("h2")!;
      this.status = root.querySelector(".status")!;
    }

    connectedCallback(): void {
      this.trigger.addEventListener("click", this.open);
      this.closeButton.addEventListener("click", this.close);
      this.closeButton.addEventListener("keydown", this.reverseTab);
      this.dialog.addEventListener("cancel", this.cancel);
      this.dialog.addEventListener("close", this.afterClose);
      this.dialog.addEventListener("click", this.backdrop);
      this.configure();
    }

    disconnectedCallback(): void {
      this.close();
      this.trigger.removeEventListener("click", this.open);
      this.closeButton.removeEventListener("click", this.close);
      this.closeButton.removeEventListener("keydown", this.reverseTab);
      this.dialog.removeEventListener("cancel", this.cancel);
      this.dialog.removeEventListener("close", this.afterClose);
      this.dialog.removeEventListener("click", this.backdrop);
    }

    attributeChangedCallback(name: string): void {
      if (!this.isConnected) return;
      if (name === "project-id" || name === "endpoint") {
        this.close();
        this.configure();
        return;
      }
      this.applyTheme();
      this.postTheme();
    }

    private configure(): void {
      this.origin = endpointOrigin(this.getAttribute("endpoint") ?? "", window.location);
      const valid =
        this.origin !== null && projectIdPattern.test(this.getAttribute("project-id") ?? "");
      this.trigger.disabled = !valid;
      this.status.textContent = valid
        ? ""
        : "Bug reporting is unavailable. Check the widget configuration.";
      this.applyTheme();
    }

    private applyTheme(): void {
      this.theme = themeFromAttributes((name) => this.getAttribute(name));
      this.trigger.textContent = this.theme.labels.trigger;
      this.heading.textContent = this.theme.labels.title;
      this.closeButton.textContent = this.theme.labels.close;
      if (this.iframe) this.iframe.title = this.theme.labels.title;
      this.style.setProperty("--bb-accent", this.theme.accent);
    }

    private open = (): void => {
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

    private postToFrame(message: object): void {
      if (!this.origin || !this.iframe?.contentWindow) return;
      this.iframe.contentWindow.postMessage(message, this.origin);
    }

    private postHandshake(): void {
      this.postToFrame(handshakeMessage());
    }

    private postTheme(): void {
      if (!this.protocolReady || this.themeQueued) return;
      this.themeQueued = true;
      queueMicrotask(() => {
        this.themeQueued = false;
        if (!this.protocolReady) return;
        this.postToFrame(themeMessage(this.theme));
      });
    }

    private receiveMessage = (event: MessageEvent): void => {
      if (
        !this.origin ||
        !isEmbedMessageSource(
          event.origin,
          event.source,
          this.origin,
          this.iframe?.contentWindow ?? null,
        )
      )
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

    private cancel = (event: Event): void => {
      event.preventDefault();
      this.close();
    };

    private backdrop = (event: MouseEvent): void => {
      if (event.target === this.dialog) this.close();
    };

    private reverseTab = (event: KeyboardEvent): void => {
      if (event.key === "Tab" && event.shiftKey && this.iframe) {
        event.preventDefault();
        const iframe = this.iframe;
        // Firefox ignores cross-frame focus changes during Tab keydown.
        window.requestAnimationFrame(() => {
          if (this.dialog.open && this.iframe === iframe) iframe.contentWindow?.focus();
        });
      }
    };

    private close = (): void => {
      const wasOpen = this.dialog.open;
      if (wasOpen) this.dialog.close();
      this.releaseFrame();
      if (wasOpen && this.isConnected && !this.trigger.disabled) this.trigger.focus();
    };

    private afterClose = (): void => {
      if (!this.dialog.open) this.releaseFrame();
    };

    private releaseFrame(): void {
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
