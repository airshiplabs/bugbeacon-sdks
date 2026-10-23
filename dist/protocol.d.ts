/** Wire protocol shared by the SDK and the hosted form. Version 1. */
export declare const protocolVersion = 1;
export declare const messageSource = "bugbeacon";
/** Smallest height the wire format accepts. The iframe is then raised to `minFrameHeight`. */
export declare const minWireHeight = 1;
/** Smallest height applied to the iframe. Shorter accepted messages are raised to this. */
export declare const minFrameHeight = 100;
export declare const maxFrameHeight = 4096;
export declare const labelMax = 60;
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
export declare const defaultTheme: Theme;
export type HostMessage = {
    kind: "ready";
} | {
    kind: "resize";
    height: number;
} | {
    kind: "close-request";
} | {
    kind: "submitted";
};
/** Iframe height for an accepted resize. Values under 100px are raised, not rejected. */
export declare function clampFrameHeight(height: number): number;
/** Theme from host attributes. Invalid optional values fall back to Bug Beacon defaults. */
export declare function themeFromAttributes(read: (name: string) => string | null): Theme;
/** Query string for the embed document. Theme is never placed here. */
export declare function embedSearch(parentOrigin: string): string;
export declare function embedUrl(serviceOrigin: string, projectId: string, parentOrigin: string): string;
export declare function handshakeMessage(): {
    source: typeof messageSource;
    protocol: typeof protocolVersion;
    type: "handshake";
    embed: true;
};
export declare function themeMessage(theme: Theme): {
    source: typeof messageSource;
    protocol: typeof protocolVersion;
    type: "theme";
    accent: string;
    colorScheme: Theme["colorScheme"];
    labels: ThemeLabels;
};
/**
 * Accept a message only from the iframe window and the configured service origin.
 * `null` origins (opaque documents) are rejected.
 */
export declare function isEmbedMessageSource(origin: string, source: unknown, expectedOrigin: string, frame: unknown): boolean;
/** Parse a hosted-form message. Extra fields, wrong versions, and unknown types are rejected. */
export declare function parseHostMessage(data: unknown): HostMessage | null;
