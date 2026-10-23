/** Wire protocol shared by the SDK and the hosted form. Version 1. */

export const protocolVersion = 1;
export const messageSource = "bugbeacon";
/** Smallest height the wire format accepts. The iframe is then raised to `minFrameHeight`. */
export const minWireHeight = 1;
/** Smallest height applied to the iframe. Shorter accepted messages are raised to this. */
export const minFrameHeight = 100;
export const maxFrameHeight = 4096;
export const labelMax = 60;

export interface ThemeLabels {
  trigger: string;
  title: string;
  close: string;
  submit: string;
}

export interface Theme {
  accent: string;
  colorScheme: "light" | "dark";
  labels: ThemeLabels;
}

export const defaultTheme: Theme = {
  accent: "#365fe8",
  colorScheme: "light",
  labels: {
    trigger: "Report Bug",
    title: "Report a bug",
    close: "Close",
    submit: "Send report",
  },
};

export type HostMessage =
  | { kind: "ready" }
  | { kind: "resize"; height: number }
  | { kind: "close-request" }
  | { kind: "submitted" };

const accentPattern = /^#[0-9a-f]{6}$/i;

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

function validHeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minWireHeight &&
    value <= maxFrameHeight
  );
}

/** Iframe height for an accepted resize. Values under 100px are raised, not rejected. */
export function clampFrameHeight(height: number): number {
  return Math.max(minFrameHeight, height);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function label(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > labelMax || hasControlCharacter(trimmed))
    return fallback;
  return trimmed;
}

/** Theme from host attributes. Invalid optional values fall back to Bug Beacon defaults. */
export function themeFromAttributes(read: (name: string) => string | null): Theme {
  const accent = read("accent");
  const scheme = read("color-scheme");
  return {
    accent:
      accent !== null && accentPattern.test(accent.trim())
        ? accent.trim().toLowerCase()
        : defaultTheme.accent,
    colorScheme: scheme === "light" || scheme === "dark" ? scheme : defaultTheme.colorScheme,
    labels: {
      trigger: label(read("label"), defaultTheme.labels.trigger),
      title: label(read("heading"), defaultTheme.labels.title),
      close: label(read("close-label"), defaultTheme.labels.close),
      submit: label(read("submit-label"), defaultTheme.labels.submit),
    },
  };
}

/** Query string for the embed document. Theme is never placed here. */
export function embedSearch(parentOrigin: string): string {
  return new URLSearchParams({ origin: parentOrigin, embed: "1" }).toString();
}

export function embedUrl(serviceOrigin: string, projectId: string, parentOrigin: string): string {
  return `${serviceOrigin}/embed/${encodeURIComponent(projectId)}?${embedSearch(parentOrigin)}`;
}

export function handshakeMessage(): {
  source: typeof messageSource;
  protocol: typeof protocolVersion;
  type: "handshake";
  embed: true;
} {
  return { source: messageSource, protocol: protocolVersion, type: "handshake", embed: true };
}

export function themeMessage(theme: Theme): {
  source: typeof messageSource;
  protocol: typeof protocolVersion;
  type: "theme";
  accent: string;
  colorScheme: Theme["colorScheme"];
  labels: ThemeLabels;
} {
  return {
    source: messageSource,
    protocol: protocolVersion,
    type: "theme",
    accent: theme.accent,
    colorScheme: theme.colorScheme,
    labels: { ...theme.labels },
  };
}

/**
 * Accept a message only from the iframe window and the configured service origin.
 * `null` origins (opaque documents) are rejected.
 */
export function isEmbedMessageSource(
  origin: string,
  source: unknown,
  expectedOrigin: string,
  frame: unknown,
): boolean {
  return (
    typeof frame === "object" &&
    frame !== null &&
    source === frame &&
    origin === expectedOrigin &&
    expectedOrigin.length > 0 &&
    expectedOrigin !== "null"
  );
}

/** Parse a hosted-form message. Extra fields, wrong versions, and unknown types are rejected. */
export function parseHostMessage(data: unknown): HostMessage | null {
  const message = plainRecord(data);
  if (!message) return null;
  const keys = Object.keys(message);
  if (message.source !== messageSource || message.protocol !== protocolVersion) return null;
  if (
    message.type === "ready" ||
    message.type === "close-request" ||
    message.type === "submitted"
  ) {
    return keys.length === 3 ? { kind: message.type } : null;
  }
  if (message.type === "resize" && keys.length === 4 && validHeight(message.height)) {
    return { kind: "resize", height: message.height };
  }
  return null;
}
