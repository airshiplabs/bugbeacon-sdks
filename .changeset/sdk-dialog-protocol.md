---
"@bugbeacon/browser": minor
---

Own the report dialog in the SDK: one Close button, overlay, Escape, focus trap, and backdrop click, including when the iframe never loads. Speak embed protocol 1 (`ready`, `handshake`, `theme`, `resize`, `close-request`, `submitted`) with strict origin checks, `embed=1`, iframe height from `resize`, and theme options after `ready`. Publish the parser at `@bugbeacon/browser/protocol`. 0.2.0 replaces 0.1.0 embeds and does not accept `bugbeacon:ready`, `bugbeacon:init`, or `bugbeacon:close`.
