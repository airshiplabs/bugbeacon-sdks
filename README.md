# BugBeacon

Bug reports from your site go to GitHub Projects (Projects v2) as draft items.

<!-- PLACEHOLDER: Add a screenshot or GIF of the Report Bug button and hosted form here. -->

## Install

```
Tell your coding agent: Install BugBeacon by following https://github.com/airshiplabs/bugbeacon-sdks/blob/main/INSTALL.md
```

Details: [INSTALL.md](INSTALL.md).

[bugbeacon.ai](https://bugbeacon.ai) · [Documentation](https://bugbeacon.ai/docs)

Free during early access.

## Theming

Set these optional attributes on `<bug-beacon>`. Defaults match BugBeacon branding. The widget sends them to the hosted form after the form reports ready. It does not check your plan. The server decides which theme values to apply.

| Attribute      | Default        | What it changes                                     |
| -------------- | -------------- | --------------------------------------------------- |
| `label`        | `Report Bug`   | Trigger button text                                 |
| `heading`      | `Report a bug` | Dialog title                                        |
| `close-label`  | `Close`        | The dialog's Close button                           |
| `submit-label` | `Send report`  | Submit button inside the hosted form                |
| `accent`       | `#365fe8`      | Trigger color and form accent. Use a `#rrggbb` hex  |
| `color-scheme` | `light`        | `light` or `dark` for the dialog shell and the form |

```html
<bug-beacon
  project-id="00000000-0000-4000-8000-000000000000"
  endpoint="https://bugbeacon.ai"
  color-scheme="dark"
  accent="#112233"
  label="Found a bug"
></bug-beacon>
```

Theme values are not put in the embed URL.

## Embed protocol

The dialog shell (overlay, the only Close button, Escape, focus trap, and backdrop click) lives in this SDK. Close works even when the iframe never loads. The iframe URL is `{endpoint}/embed/{encodeURIComponent(project-id)}?origin={parentOrigin}&embed=1`.

Import the shared parser from `@bugbeacon/browser/protocol` (`parseHostMessage`, `protocolVersion`, `minFrameHeight`, `maxFrameHeight`, `labelMax`). The hosted form should use that module instead of re-declaring the types.

Messages use `postMessage` and are accepted only from the iframe window on the `endpoint` origin. Each message is a plain object with exact keys. Messages with extra keys are rejected.

Parent to form, after the form sends `ready`:

```json
{ "source": "bugbeacon", "protocol": 1, "type": "handshake", "embed": true }
```

```json
{
  "source": "bugbeacon",
  "protocol": 1,
  "type": "theme",
  "accent": "#365fe8",
  "colorScheme": "light",
  "labels": {
    "trigger": "Report Bug",
    "title": "Report a bug",
    "close": "Close",
    "submit": "Send report"
  }
}
```

Form to parent:

```json
{ "source": "bugbeacon", "protocol": 1, "type": "ready" }
```

```json
{ "source": "bugbeacon", "protocol": 1, "type": "resize", "height": 480 }
```

`height` is an integer CSS pixel count from 1 to 4096. The iframe does not scroll itself. A height under 100 is still accepted, and the SDK raises the iframe to 100px. It does not reject that message.

```json
{ "source": "bugbeacon", "protocol": 1, "type": "close-request" }
```

```json
{ "source": "bugbeacon", "protocol": 1, "type": "submitted" }
```

`submitted` leaves the dialog open and sets the status text to "Report submitted."

`source` is the product key. FeatureFountain uses the same shapes with `"source": "featurefountain"`.

0.2.0 replaces 0.1.0 embeds. The SDK does not accept `bugbeacon:ready`, `bugbeacon:init`, or `bugbeacon:close`.

## Version negotiation

The handshake `protocol` number is the highest version the page speaks. This SDK speaks `1`. A message with a higher `protocol` number is ignored. The dialog stays open, and `resize` or `close-request` at that version does nothing.

`resize` is applied only after that handshake. A `resize` that arrives first is kept and used once `ready` has been answered.

## Optional channel

Protocol 1 does not include a `channel` field, and this SDK does not send one. A later addition can pass a random per-mount id as a `channel` query parameter and echo that string on each message without bumping the protocol number. Receivers would ignore a `channel` that does not match the mount, and would still accept a message that omits `channel`. Do not send `channel` until both sides accept it. Today an extra field is rejected.

## Requirement

You need a GitHub Project you can edit. Connect it in BugBeacon. Your users do not need GitHub accounts.

## Contact

support@airshiplabs.com

## License

MIT. See [LICENSE](LICENSE).

## Development

This repository ships `@bugbeacon/browser`. Node.js 24 or later.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
```

See [INSTALL.md](INSTALL.md) for embedding the widget in a host application.
