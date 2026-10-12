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

## Widget configuration

| Name         | Kind                  | Required | Description                                                                                                                                                                              |
| ------------ | --------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-id` | attribute             | Yes      | Public BugBeacon application UUID.                                                                                                                                                       |
| `endpoint`   | attribute             | Yes      | BugBeacon service origin (for example `https://bugbeacon.ai`).                                                                                                                           |
| `metadata`   | attribute or property | No       | Optional flat JSON of app context (version, plan, user id). Shown to reporters and sent with the report; never include secrets. Up to 20 keys, 4 KB total. Property overrides attribute. |

Example: `metadata='{"version":"2.4.1","plan":"pro"}'` or `element.metadata = { version: "2.4.1" }`.

## Browser behavior and privacy

The widget does not read host page contents, cookies, storage, or the full URL. When the hosted form opens, it may receive:

- **Page URL** — `origin` + `pathname` only (query string and hash are stripped before send).
- **Viewport** — host window size (for example `1440x900`).
- **Metadata** — only what your app sets on `<bug-beacon>`.

Reporters see these values in the form and can turn them off before submit. See [INSTALL.md](INSTALL.md) for limits and framework examples.
