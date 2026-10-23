# Install Bug Beacon in a host application

This guide is for coding agents and developers wiring `@bugbeacon/browser` or the hosted script into an existing app. The custom element tag name is **`bug-beacon`**.

Product site: [bugbeacon.ai](https://bugbeacon.ai). User-facing docs: [bugbeacon.ai/docs](https://bugbeacon.ai/docs).

## What you are installing

- A **Report Bug** button (custom element `<bug-beacon>`) that opens Bug Beacon’s hosted form in a modal iframe.
- Reporters type in the iframe. The widget does not read report text, cookies, storage, or host DOM contents.
- Submissions are delivered to a **GitHub Project (Projects v2)** as **draft items**. GitHub tokens and project wiring stay on the Bug Beacon service, not in your page.

## Choose script tag or npm

Inspect the host repository and pick one path:

| Host stack                                             | Prefer                                               |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Plain HTML, static site, or CMS with a layout template | **Script tag** (`https://bugbeacon.ai/widget/v1.js`) |
| React, Next.js, Vue, Svelte, or any bundler-based app  | **npm** (`@bugbeacon/browser` + `defineBugBeacon()`) |
| No `package.json`, or you cannot add a dependency      | **Script tag**                                       |
| Server-rendered UI (Next.js, Nuxt, SvelteKit, etc.)    | **npm** and register on the **client only**          |

**Script tag:** the file registers `<bug-beacon>` automatically and exposes `window.BugBeacon.defineBugBeacon()`. Repeated registration is harmless.

**npm:** `import { defineBugBeacon } from "@bugbeacon/browser"` is safe during server rendering (it no-ops without `window`). You must call `defineBugBeacon()` in the browser before the element is used. The ESM entry does **not** auto-register.

Node.js **24+** is required for installing and building this package (`package.json` `engines`).

## Install commands

### npm

```sh
npm install @bugbeacon/browser
```

### pnpm

```sh
pnpm add @bugbeacon/browser
```

### yarn

```sh
yarn add @bugbeacon/browser
```

### From GitHub (optional)

```sh
npm install github:airshiplabs/bugbeacon-sdks#REVIEWED_FULL_COMMIT_ID
```

With npm 12, add `--allow-git=root` for a direct Git dependency. Use the same `defineBugBeacon()` flow as the npm registry package.

## Configuration attributes

The element observes only these attributes (see `src/index.ts`):

| Attribute    | Required | Value                                                                         |
| ------------ | -------- | ----------------------------------------------------------------------------- |
| `project-id` | Yes      | Public application UUID (RFC 4122 version 4). Invalid IDs disable the button. |
| `endpoint`   | Yes      | Bug Beacon service origin. Production: `https://bugbeacon.ai`.                |

**`endpoint` rules:**

- Must be a valid origin: scheme + host + optional port only (`pathname` must be `/`, no `username`, `password`, `search`, or `hash`).
- **HTTPS** is required. The value is parsed with `new URL` and stored as `url.origin`.
- **HTTP** is allowed only when the endpoint hostname and the host page hostname are both exactly `localhost`. `127.0.0.1` and `::1` are not accepted for HTTP.
- Invalid `project-id` or `endpoint` disables the button and shows: _Bug reporting is unavailable. Check the widget configuration._

Optional theme attributes (all fall back to Bug Beacon defaults when missing or invalid):

| Attribute      | Default        | Value                                                       |
| -------------- | -------------- | ----------------------------------------------------------- |
| `label`        | `Report Bug`   | Trigger button text. 1–60 characters.                       |
| `heading`      | `Report a bug` | Dialog title.                                               |
| `close-label`  | `Close`        | The SDK Close button. The dialog has one Close control.     |
| `submit-label` | `Send report`  | Submit label sent to the hosted form.                       |
| `accent`       | `#365fe8`      | `#rrggbb` hex. Applied to the trigger and sent to the form. |
| `color-scheme` | `light`        | `light` or `dark`.                                          |

There are no other element attributes, properties, or slots in this SDK. Theme values are sent in a `theme` message after the form is ready. They are not placed in the embed URL. Plan limits are enforced by the hosted form, not by this package.

**Embed URL (when the button opens):**

```http
{endpoint}/embed/{encodeURIComponent(project-id)}?origin={encodeURIComponent(window.location.origin)}&embed=1
```

The widget sends only the public project ID (percent-encoded in the path), the parent page’s `window.location.origin` (not path, query, or hash), and `embed=1`. `embed=1` plus the handshake message tells the hosted form to hide its own close button. 0.2.0 replaces 0.1.0 embeds and does not accept the old messages. The widget does not attach application version or environment name.

### Environment variables (host app conventions)

Use public env vars your framework exposes to the browser, then bind them to attributes:

| Variable (suggested)                                                                                                      | Maps to      | Default if unset       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------- |
| `BUGBEACON_PROJECT_ID` / `NEXT_PUBLIC_BUGBEACON_PROJECT_ID` / `VITE_BUGBEACON_PROJECT_ID` / `PUBLIC_BUGBEACON_PROJECT_ID` | `project-id` | None (required)        |
| `BUGBEACON_ENDPOINT` / `NEXT_PUBLIC_BUGBEACON_ENDPOINT` / `VITE_BUGBEACON_ENDPOINT` / `PUBLIC_BUGBEACON_ENDPOINT`         | `endpoint`   | `https://bugbeacon.ai` |

Never put GitHub tokens or other secrets in these variables or in HTML.

## Script tag integration

```html
<script src="https://bugbeacon.ai/widget/v1.js" defer></script>
<bug-beacon
  project-id="00000000-0000-4000-8000-000000000000"
  endpoint="https://bugbeacon.ai"
></bug-beacon>
```

Place `<bug-beacon>` where the button should appear (header, footer, or settings area). One element is enough for most apps; multiple elements are supported.

For local development against a loopback Bug Beacon service, set `endpoint` to that service origin (for example `http://localhost:3000` in `examples/index.html`) and allow the host origin in Bug Beacon (see below).

## npm integration by framework

### Plain HTML (built artifact)

Serve `node_modules/@bugbeacon/browser/dist/bugbeacon.js` or copy it to your static assets, then:

```html
<script src="/path/to/bugbeacon.js" defer></script>
<bug-beacon project-id="…" endpoint="https://bugbeacon.ai"></bug-beacon>
```

### React (Vite, CRA, etc.)

Client entry (for example `main.tsx`):

```ts
import { defineBugBeacon } from "@bugbeacon/browser";

defineBugBeacon();
```

```tsx
export function ReportBug() {
  const projectId = import.meta.env.VITE_BUGBEACON_PROJECT_ID;
  return (
    <bug-beacon
      project-id={projectId}
      endpoint={import.meta.env.VITE_BUGBEACON_ENDPOINT ?? "https://bugbeacon.ai"}
    />
  );
}
```

### Next.js App Router

Register in a client component:

```tsx
"use client";

import { useEffect } from "react";
import { defineBugBeacon } from "@bugbeacon/browser";

export function BugBeaconWidget() {
  useEffect(() => {
    defineBugBeacon();
  }, []);

  return (
    <bug-beacon
      project-id={process.env.NEXT_PUBLIC_BUGBEACON_PROJECT_ID!}
      endpoint={process.env.NEXT_PUBLIC_BUGBEACON_ENDPOINT ?? "https://bugbeacon.ai"}
    />
  );
}
```

Mount `BugBeaconWidget` in a layout or shell that renders on every page where reporting should be available.

### Next.js Pages Router

Call `defineBugBeacon()` inside `useEffect` in `_app.tsx` (client) or a dedicated client component, then render `<bug-beacon>` in your layout.

### Vue 3

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { defineBugBeacon } from "@bugbeacon/browser";

onMounted(() => {
  defineBugBeacon();
});
</script>

<template>
  <bug-beacon :project-id="projectId" endpoint="https://bugbeacon.ai" />
</template>
```

Use `compilerOptions.isCustomElement: (tag) => tag === 'bug-beacon'` in `vite.config.ts` if the template compiler warns on unknown tags.

### Svelte / SvelteKit

Call `defineBugBeacon()` in `onMount` in the component that renders the element, or in a client-only `+layout.svelte`. Use SvelteKit’s client boundary so registration does not run during SSR.

### TypeScript and JSX

Add a global intrinsic for React/JSX:

```ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "bug-beacon": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "project-id": string;
          endpoint?: string;
        },
        HTMLElement
      >;
    }
  }
}
```

For Vue, extend `GlobalComponents` or rely on `isCustomElement`.

## Content Security Policy

On the **host page** CSP:

| Directive    | Allow                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `script-src` | `https://bugbeacon.ai` when using the hosted widget script (or your origin if you self-host `bugbeacon.js`) |
| `frame-src`  | The configured `endpoint` origin (for example `https://bugbeacon.ai`)                                       |

The iframe loads Bug Beacon’s embed document and form; challenge and API requests run inside that document’s origin. The parent widget only uses `postMessage` with the configured `endpoint` origin.

Protocol 1 messages are plain objects with exact keys. Messages with extra keys are rejected. The form sends `ready`, `resize` (`height` integer 1–4096; the iframe is raised to 100px when the value is smaller), `close-request`, and `submitted`. The handshake `protocol` number is the highest version the page speaks. An unknown `protocol` number is ignored. 0.1.0 `bugbeacon:ready`, `bugbeacon:init`, and `bugbeacon:close` messages are not accepted. See the README for that rule and for the optional `channel` id. After `ready`, the SDK sends `handshake` (`embed: true`) and then `theme` (`accent`, `colorScheme`, `labels`). See [README](README.md) for the JSON shapes.

## GitHub and Bug Beacon setup

### Steps a coding agent can do in the host repo

- Add the script or npm dependency.
- Register `defineBugBeacon()` on the client when using npm.
- Place `<bug-beacon>` with the correct `project-id` and `endpoint`.
- Wire public env vars and document them in `.env.example`.
- Add CSP `script-src` / `frame-src` entries when the app uses a strict policy.
- Run the app locally and confirm the **Report Bug** button is enabled (not showing the unavailable message).

### Human-only steps (Bug Beacon dashboard)

These require signing in at [bugbeacon.ai/sign-in](https://bugbeacon.ai/sign-in) with **GitHub**. Reporters on your site do **not** need GitHub.

1. **Sign in** with GitHub at [bugbeacon.ai](https://bugbeacon.ai).
2. **Register the application** (name and settings in the Bug Beacon dashboard).
3. **Allow exact origins** that will host the widget, including production URLs and local dev origins (for example `http://localhost:4100`). `http://localhost:4100` and `http://127.0.0.1:4100` are different origins; allow the one you use consistently.
4. **Connect a GitHub Project** you can edit (GitHub Projects v2). Reports are created as **draft items** in that project.
5. **Create the per-app GitHub token** in Bug Beacon when prompted. Use a token with **only the access Bug Beacon requests in that UI** (terms: [bugbeacon.ai/terms](https://bugbeacon.ai/terms)). Store tokens only in Bug Beacon, never in the host app or repository.
6. Copy the **public project ID** (UUID) from the dashboard into `project-id` or your env vars.

If any human step is incomplete, fix it in the dashboard before debugging the host app.

## Verify end-to-end

1. Run the host app on an origin listed in Bug Beacon.
2. Click **Report Bug**. The modal should load the embed (`data-initialized` / form visible).
3. Submit a test report in the hosted form.
4. Open the connected GitHub Project and confirm a new **draft** item appears.

Local example in this repo: set `project-id` and `endpoint` in `examples/index.html`, then:

```sh
python3 -m http.server 4100
```

Open `http://localhost:4100/examples/` and allow `http://localhost:4100` in Bug Beacon application settings.

## Troubleshooting

| Symptom                                                  | Likely cause                        | Fix                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Button disabled; “Bug reporting is unavailable…”         | Invalid `project-id` or `endpoint`  | Use a version-4 UUID and a bare origin (`https://bugbeacon.ai`). No path, query, or credentials.                                |
| Button disabled on local HTTP                            | Page or endpoint is not `localhost` | Use `http://localhost` for both, or use HTTPS. `127.0.0.1` is not an HTTP exception.                                            |
| Embed loads but submission fails or is rejected          | Origin not allowlisted              | Add the exact `window.location.origin` in Bug Beacon application settings.                                                      |
| Works on `localhost` but not `127.0.0.1` (or vice versa) | Origin mismatch                     | Allow the origin you actually use; they are not interchangeable.                                                                |
| Blank or blocked iframe                                  | CSP `frame-src`                     | Allow the `endpoint` origin.                                                                                                    |
| Script does not load                                     | CSP `script-src`                    | Allow `https://bugbeacon.ai` (or your self-hosted script origin).                                                               |
| Custom element unknown / no button                       | npm without registration            | Call `defineBugBeacon()` in the browser before rendering `<bug-beacon>`.                                                        |
| Nothing reaches GitHub                                   | GitHub token or project connection  | Reconnect the project or replace the token in the Bug Beacon dashboard (human-only). Revoke old tokens in GitHub when rotating. |

## API surface (this package)

| Export / global                               | Behavior                                                             |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `defineBugBeacon()` from `@bugbeacon/browser` | Registers `<bug-beacon>` when `window.customElements` exists.        |
| `window.BugBeacon.defineBugBeacon()`          | Same; available after loading `widget/v1.js` or `dist/bugbeacon.js`. |
| `<bug-beacon project-id endpoint>`            | UI and iframe lifecycle; see attributes above.                       |

Hosted script URL (production): `https://bugbeacon.ai/widget/v1.js` (built from `dist/bugbeacon.js` in this repository).

## Contact

support@airshiplabs.com
