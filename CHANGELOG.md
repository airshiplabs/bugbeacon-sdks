# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- SDK-owned dialog shell with one Close button, overlay, Escape, focus trap, and backdrop click. Close works when the iframe never loads.
- Embed protocol 1: `ready`, `handshake`, `theme`, `resize`, `close-request`, and `submitted`, plus optional theme attributes.
- Legacy `bugbeacon:ready`, `bugbeacon:init`, and `bugbeacon:close` messages still work.

## [0.1.0] - 2026-09-29

### Added

- Initial public release of `@bugbeacon/browser` with the `<bug-beacon>` element,
  ESM imports, TypeScript declarations, and a standalone browser script.
- Hosted report form, keyboard controls, focus restoration, origin-checked
  messaging, and lifecycle cleanup without collecting host-page contents.
