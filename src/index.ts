const projectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

function endpointOrigin(value: string, host: Location): string | null {
  try {
    const url = new URL(value);
    const local =
      url.protocol === "http:" &&
      isLoopback(url.hostname) &&
      isLoopback(host.hostname);
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

/** Register the <bug-beacon> element. Calling this during server rendering does nothing. */
export function defineBugBeacon(): void {
  if (
    typeof window === "undefined" ||
    !window.customElements ||
    window.customElements.get("bug-beacon")
  )
    return;

  class BugBeaconElement extends HTMLElement {
    static observedAttributes = ["project-id", "endpoint"];
    private readonly trigger: HTMLButtonElement;
    private readonly dialog: HTMLDialogElement;
    private readonly closeButton: HTMLButtonElement;
    private readonly status: HTMLParagraphElement;
    private iframe: HTMLIFrameElement | null = null;
    private origin: string | null = null;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = markup;
      this.trigger = root.querySelector(".trigger")!;
      this.dialog = root.querySelector("dialog")!;
      this.closeButton = root.querySelector(".close")!;
      this.status = root.querySelector(".status")!;
    }

    connectedCallback(): void {
      this.trigger.addEventListener("click", this.open);
      this.closeButton.addEventListener("click", this.close);
      this.closeButton.addEventListener("keydown", this.reverseTab);
      this.dialog.addEventListener("cancel", this.cancel);
      this.dialog.addEventListener("close", this.afterClose);
      this.configure();
    }

    disconnectedCallback(): void {
      this.close();
      this.trigger.removeEventListener("click", this.open);
      this.closeButton.removeEventListener("click", this.close);
      this.closeButton.removeEventListener("keydown", this.reverseTab);
      this.dialog.removeEventListener("cancel", this.cancel);
      this.dialog.removeEventListener("close", this.afterClose);
    }

    attributeChangedCallback(): void {
      if (this.isConnected) {
        this.close();
        this.configure();
      }
    }

    private configure(): void {
      this.origin = endpointOrigin(
        this.getAttribute("endpoint") ?? "",
        window.location,
      );
      const valid =
        this.origin !== null &&
        projectIdPattern.test(this.getAttribute("project-id") ?? "");
      this.trigger.disabled = !valid;
      this.status.textContent = valid
        ? ""
        : "Bug reporting is unavailable. Check the widget configuration.";
    }

    private open = (): void => {
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

    private receiveMessage = (event: MessageEvent): void => {
      if (
        !this.iframe ||
        !this.origin ||
        event.source !== this.iframe.contentWindow ||
        event.origin !== this.origin
      )
        return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const message = data as Record<string, unknown>;
      if (Object.keys(message).length !== 2 || message.version !== 1) return;
      if (message.type === "bugbeacon:ready") {
        this.iframe.contentWindow?.postMessage(
          { type: "bugbeacon:init", version: 1 },
          this.origin,
        );
      } else if (message.type === "bugbeacon:close") {
        this.close();
      }
    };

    private cancel = (event: Event): void => {
      event.preventDefault();
      this.close();
    };

    private reverseTab = (event: KeyboardEvent): void => {
      if (event.key === "Tab" && event.shiftKey && this.iframe) {
        event.preventDefault();
        const iframe = this.iframe;
        // Firefox ignores cross-frame focus changes during Tab keydown.
        window.requestAnimationFrame(() => {
          if (this.dialog.open && this.iframe === iframe)
            iframe.contentWindow?.focus();
        });
      }
    };

    private close = (): void => {
      const wasOpen = this.dialog.open;
      if (wasOpen) this.dialog.close();
      this.releaseFrame();
      if (wasOpen && this.isConnected && !this.trigger.disabled)
        this.trigger.focus();
    };

    private afterClose = (): void => {
      if (!this.dialog.open) this.releaseFrame();
    };

    private releaseFrame(): void {
      window.removeEventListener("message", this.receiveMessage);
      this.iframe?.remove();
      this.iframe = null;
      this.dialog.querySelector(".focus-guard")?.remove();
    }
  }

  window.customElements.define("bug-beacon", BugBeaconElement);
}
