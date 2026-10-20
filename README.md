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

The dialog shell (overlay, the only Close button, Escape, focus trap, and backdrop click) lives in this SDK. Close works even when the iframe never loads. The iframe URL is `{endpoint}/embed/{project-id}?origin={parentOrigin}&embed=1`.

Messages use `postMessage` and are accepted only from the iframe window on the `endpoint` origin. Each message is a plain object with exact keys.

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

`height` is an integer CSS pixel count from 1 to 4096. The iframe uses that height and does not scroll itself.

```json
{ "source": "bugbeacon", "protocol": 1, "type": "close-request" }
```

```json
{ "source": "bugbeacon", "protocol": 1, "type": "submitted" }
```

`submitted` leaves the dialog open and sets the status text to "Report submitted."

`source` is the product key. FeatureFountain uses the same shapes with `"source": "featurefountain"`.

Legacy 0.1.0 messages still work. The form sends `{ "type": "bugbeacon:ready", "version": 1 }`, the SDK replies `{ "type": "bugbeacon:init", "version": 1 }`, and `{ "type": "bugbeacon:close", "version": 1 }` closes the dialog. A form that does not receive `embed=1` and `handshake` keeps its own close button.

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
