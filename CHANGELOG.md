# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-10-12

### Added

- Widget init protocol version 2: `bugbeacon:init` may include `context` with
  `pageUrl` (origin and path only), `viewport` (host window size), and optional
  `metadata` from the `<bug-beacon>` property or JSON `metadata` attribute.
- `metadata` on `<bug-beacon>` for app context (version, plan, userId, and
  similar). Values are validated in the browser; invalid keys are dropped with a
  console warning that names the key only.
- Falls back to init version 1 when page URL or viewport cannot be collected.

## [0.1.0] - 2026-09-29

### Added

- Initial public release of `@bugbeacon/browser` with the `<bug-beacon>` element,
  ESM imports, TypeScript declarations, and a standalone browser script.
- Hosted report form, keyboard controls, focus restoration, origin-checked
  messaging, and lifecycle cleanup without collecting host-page contents.
