import type { BugBeaconMetadata } from "./metadata.js";
export type BugBeaconInitContext = {
    pageUrl: string;
    viewport: string;
    metadata?: BugBeaconMetadata;
};
export declare function buildPageUrl(location: Location): string | undefined;
export declare function buildViewport(window: Window): string | undefined;
export declare function buildInitContext(window: Window, metadata?: BugBeaconMetadata): BugBeaconInitContext | undefined;
