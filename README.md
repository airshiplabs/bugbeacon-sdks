# BugBeacon

Bug reports from your site go to GitHub Projects (Projects v2) as draft items.

<!-- PLACEHOLDER: Add a screenshot or GIF of the Report Bug button and hosted form here. -->

[bugbeacon.ai](https://bugbeacon.ai) · [Documentation](https://bugbeacon.ai/docs)

Free during early access.

## Requirements

You need a [GitHub Project](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects) you can edit. Connect it in BugBeacon. Your users do not need GitHub accounts.

## Install (script tag)

Register your application in BugBeacon, connect its GitHub Project, and allow your site's exact origin. Replace the example project ID.

```html
<script src="https://bugbeacon.ai/widget/v1.js" defer></script>
<bug-beacon
  project-id="00000000-0000-4000-8000-000000000000"
  endpoint="https://bugbeacon.ai"
></bug-beacon>
```

The script registers the `<bug-beacon>` custom element. It also exposes `window.BugBeacon.defineBugBeacon()`. Repeated registration is harmless.

## Install (npm)

Node.js 24 or later.

```sh
npm install @bugbeacon/browser
```

```js
import { defineBugBeacon } from "@bugbeacon/browser";

defineBugBeacon();
```

```html
<bug-beacon
  project-id="00000000-0000-4000-8000-000000000000"
  endpoint="https://bugbeacon.ai"
></bug-beacon>
```

Call `defineBugBeacon()` in the browser. The ESM entry does not register the element automatically. Imports are safe during server rendering.

The package ships `dist/index.js`, TypeScript declarations, and the plain script `dist/bugbeacon.js`.

## Install from GitHub

```sh
npm install github:airshiplabs/bugbeacon-sdks#REVIEWED_FULL_COMMIT_ID
```

With npm 12, add `--allow-git=root` to permit this direct Git dependency. Use the same import and registration as npm.

## Configuration

| Attribute    | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| `project-id` | The UUID v4 public application ID from BugBeacon.                  |
| `endpoint`   | The BugBeacon HTTPS origin, including a nondefault port if needed. |

The endpoint cannot contain credentials, an application path, a query string, or a fragment. HTTP is permitted only when both the service and host application use loopback hostnames or addresses: `localhost`, `127.*`, or `::1`. Invalid configuration disables the button and displays an unavailable message. Changing either attribute closes an open form and applies the new configuration.

Multiple elements can coexist. Removing an element closes its dialog and removes its message listener. Reinserting it restores its behavior.

## Browser behavior and privacy

Opening the button loads `/embed/{project-id}?origin={encoded-parent-origin}`. The widget sends the public project ID and parent origin, and exchanges only versioned readiness, initialization, and closure messages. It checks the sending window and origin before processing a message. The hosted form sends the closure message when Escape is pressed inside its document, because keyboard events do not cross iframe origins.

The widget does not read report text, host cookies, storage, DOM contents, or the host URL path, query, or fragment. It sets the iframe referrer policy to `no-referrer`. Normal browser networking still reaches the configured service. BugBeacon uses server-side challenge verification and quotas to control public submissions.

The native modal keeps keyboard focus inside the form, provides a visible Close button, supports Escape, and restores focus to Report Bug. Closing the dialog discards its iframe and any unsent draft. Errors within an open form preserve report text according to the service's submission contract.

Allow the configured endpoint in your host application's `frame-src` policy. If loading the hosted script, allow its origin in `script-src` as well. Configure the same host origin in BugBeacon. Embedding through additional ancestor origins is intentionally unsupported. Current Chromium, Firefox, and Safari are supported.

Reporters enter text inside the service iframe. GitHub credentials and project destinations stay in the BugBeacon service.

## Development

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
```

`npm run build` regenerates distributions and declarations from `src/`. The service copies `dist/bugbeacon.js` to `/widget/v1.js`.

To try the plain HTML example with a configured local service, set its project ID and endpoint in `examples/index.html`, then serve the repository:

```sh
python3 -m http.server 4100
```

Open `http://localhost:4100/examples/` and allow `http://localhost:4100` in your local BugBeacon application settings.

## Contact

support@airshiplabs.com

## License

MIT. See [LICENSE](LICENSE).
