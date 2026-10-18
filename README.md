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

`npm ci` installs a pre-commit hook in `.git/hooks`. It rejects any staged file over 5,000 tokens (20,000 bytes). Split the file, or, if it is generated, add its path to the ignore list in `scripts/file-token-limit.mjs`. Lockfiles, `dist/`, and other generated or binary files are already ignored. If you set `core.hooksPath`, chain `node scripts/file-token-limit.mjs` from that hook.

See [INSTALL.md](INSTALL.md) for embedding the widget in a host application.
