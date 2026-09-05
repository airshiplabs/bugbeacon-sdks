# BugBeacon widget

A framework-independent Report Bug button that opens the BugBeacon hosted form.
Reporters enter their text inside the service iframe. GitHub credentials and
destinations stay in the BugBeacon service.

## Install with a script

Register your application in BugBeacon, connect its GitHub Project, and allow
your application's exact origin. Replace the example project ID below.

```html
<script src="https://bugbeacon.ai/widget/v1.js" defer></script>
<bug-beacon
  project-id="00000000-0000-4000-8000-000000000000"
  endpoint="https://bugbeacon.ai"
></bug-beacon>
```

The script registers the custom element automatically. It also exposes
`window.BugBeacon.defineBugBeacon()`. Repeated registration is harmless.
The hosted script requires a deployed BugBeacon service. No npm registry
publication is assumed.

## Install from GitHub

Use a reviewed full commit ID when installing from the public repository:

```sh
npm install github:airshiplabs/bugbeacon-widget#REVIEWED_FULL_COMMIT_ID
```

```js
import { defineBugBeacon } from "@bugbeacon/widget";

defineBugBeacon();
```

Then render the same `<bug-beacon>` element shown above. Imports are safe during
server rendering. Call `defineBugBeacon()` in the browser to register the element.
The ESM entry does not automatically register it.

The repository includes `dist/index.js`, TypeScript declarations, and the plain
script `dist/bugbeacon.js`. A package file allowlist includes only distribution,
source, examples, this README, and the MIT license.

## Configuration

| Attribute    | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| `project-id` | The UUID v4 public application ID from BugBeacon.                  |
| `endpoint`   | The BugBeacon HTTPS origin, including a nondefault port if needed. |

The endpoint cannot contain credentials, an application path, a query string,
or a fragment. HTTP is permitted only when both the service and host application
use loopback hostnames or addresses: `localhost`, `127.*`, or `::1`.
Invalid configuration disables the button and displays an unavailable message.
Changing either attribute closes an open form and applies the new configuration.

Multiple elements can coexist. Removing an element closes its dialog and removes
its message listener. Reinserting it restores its behavior.

## Browser behavior and privacy

Opening the button loads `/embed/{project-id}?origin={encoded-parent-origin}`.
The widget sends the public project ID and parent origin, and exchanges only
versioned readiness, initialization, and closure messages. It checks the sending
window and origin before processing a message.
The hosted form sends the closure message when Escape is pressed inside its
document, because keyboard events do not cross iframe origins.

The widget does not read report text, host cookies, storage, DOM contents, or the
host URL path/query/fragment. It sets the iframe referrer policy to `no-referrer`.
Normal browser networking still reaches the configured service. BugBeacon uses
server-side challenge verification and quotas to control public submissions.

The native modal keeps keyboard focus inside the form, provides a visible Close
button, supports Escape, and restores focus to Report Bug. Closing the dialog
discards its iframe and any unsent draft. Errors within an open form preserve
report text according to the service's submission contract.

Allow the configured endpoint in your host application's `frame-src` policy.
If loading the hosted script, allow its origin in `script-src` as well. Configure
the same host origin in BugBeacon. Embedding through additional ancestor origins
is intentionally unsupported. Current Chromium, Firefox, and Safari are supported.

## Development

Use Node 24 and npm:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
npm audit
npm pack --dry-run
```

`npm run build` regenerates both distributions and declarations from `src/`.
Commit distribution updates with their corresponding source changes. The service
copies `dist/bugbeacon.js` to `/widget/v1.js` with the license and provenance.

The tests use controlled browser responses. They verify the widget protocol,
privacy, validation, lifecycle, and keyboard behavior in three browser engines.
They do not establish live GitHub or Turnstile delivery.

To try the plain HTML example with a configured local service, set its project ID
and endpoint in `examples/index.html`, then serve the repository:

```sh
python3 -m http.server 4100
```

Open `http://localhost:4100/examples/` and allow `http://localhost:4100` in your
local BugBeacon application settings. The example contains no private token.

## License

MIT. See [LICENSE](LICENSE).
