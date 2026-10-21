# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-10-21

### Added

- SDK-owned dialog shell with one Close button, overlay, Escape, focus trap, and backdrop click. Close works when the iframe never loads.
- Embed protocol 1: `ready`, `handshake`, `theme`, `resize`, `close-request`, and `submitted`, plus optional theme attributes.
- 0.2.0 replaces 0.1.0 embeds. There is no compatibility with `bugbeacon:ready`, `bugbeacon:init`, or `bugbeacon:close`.
- Public `@bugbeacon/browser/protocol` export for the shared message types, constants, and parser.
- Resize heights from 1 to 4096 are accepted. The iframe is raised to 100px when the message is shorter.
- `resize` is applied after the handshake. An earlier `resize` is kept until `ready`.
- HTTP endpoints are limited to hostname `localhost` when the page hostname is also `localhost`.

## [0.1.0] - 2026-09-29

### Added

- Initial public release of `@bugbeacon/browser` with the `<bug-beacon>` element,
  ESM imports, TypeScript declarations, and a standalone browser script.
- Hosted report form, keyboard controls, focus restoration, origin-checked
  messaging, and lifecycle cleanup without collecting host-page contents.
