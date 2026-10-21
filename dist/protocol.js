/*! @bugbeacon/browser v0.1.0 | MIT License | https://github.com/airshiplabs/bugbeacon-sdks */

// src/protocol.ts
var protocolVersion = 1;
var messageSource = "bugbeacon";
var minWireHeight = 1;
var minFrameHeight = 100;
var maxFrameHeight = 4096;
var labelMax = 60;
var defaultTheme = {
  accent: "#365fe8",
  colorScheme: "light",
  labels: {
    trigger: "Report Bug",
    title: "Report a bug",
    close: "Close",
    submit: "Send report"
  }
};
var accentPattern = /^#[0-9a-f]{6}$/i;
function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value;
}
function validHeight(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= minWireHeight && value <= maxFrameHeight;
}
function clampFrameHeight(height) {
  return Math.max(minFrameHeight, height);
}
function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}
function label(value, fallback) {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > labelMax || hasControlCharacter(trimmed))
    return fallback;
  return trimmed;
}
function themeFromAttributes(read) {
  const accent = read("accent");
  const scheme = read("color-scheme");
  return {
    accent: accent !== null && accentPattern.test(accent.trim()) ? accent.trim().toLowerCase() : defaultTheme.accent,
    colorScheme: scheme === "light" || scheme === "dark" ? scheme : defaultTheme.colorScheme,
    labels: {
      trigger: label(read("label"), defaultTheme.labels.trigger),
      title: label(read("heading"), defaultTheme.labels.title),
      close: label(read("close-label"), defaultTheme.labels.close),
      submit: label(read("submit-label"), defaultTheme.labels.submit)
    }
  };
}
function embedSearch(parentOrigin) {
  return new URLSearchParams({ origin: parentOrigin, embed: "1" }).toString();
}
function embedUrl(serviceOrigin, projectId, parentOrigin) {
  return `${serviceOrigin}/embed/${encodeURIComponent(projectId)}?${embedSearch(parentOrigin)}`;
}
function handshakeMessage() {
  return { source: messageSource, protocol: protocolVersion, type: "handshake", embed: true };
}
function themeMessage(theme) {
  return {
    source: messageSource,
    protocol: protocolVersion,
    type: "theme",
    accent: theme.accent,
    colorScheme: theme.colorScheme,
    labels: { ...theme.labels }
  };
}
function isEmbedMessageSource(origin, source, expectedOrigin, frame) {
  return typeof frame === "object" && frame !== null && source === frame && origin === expectedOrigin && expectedOrigin.length > 0 && expectedOrigin !== "null";
}
function parseHostMessage(data) {
  const message = plainRecord(data);
  if (!message) return null;
  const keys = Object.keys(message);
  if (message.source !== messageSource || message.protocol !== protocolVersion) return null;
  if (message.type === "ready" || message.type === "close-request" || message.type === "submitted") {
    return keys.length === 3 ? { kind: message.type } : null;
  }
  if (message.type === "resize" && keys.length === 4 && validHeight(message.height)) {
    return { kind: "resize", height: message.height };
  }
  return null;
}
export {
  clampFrameHeight,
  defaultTheme,
  embedSearch,
  embedUrl,
  handshakeMessage,
  isEmbedMessageSource,
  labelMax,
  maxFrameHeight,
  messageSource,
  minFrameHeight,
  minWireHeight,
  parseHostMessage,
  protocolVersion,
  themeFromAttributes,
  themeMessage
};
