export type BugBeaconMetadataValue = string | number | boolean;
export type BugBeaconMetadata = Record<string, BugBeaconMetadataValue>;
/** Normalize app metadata before it is sent in widget init context. */
export declare function sanitizeMetadata(input: unknown): BugBeaconMetadata | undefined;
export declare function parseMetadataAttribute(raw: string | null): BugBeaconMetadata | undefined;
