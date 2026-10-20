/** HTTPS origin, or HTTP only when both hostnames are exactly `localhost`. */
export declare function endpointOrigin(value: string, host: {
    hostname: string;
    origin: string;
}): string | null;
