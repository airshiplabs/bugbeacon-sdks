/** HTTPS origin, or HTTP only when both hostnames are exactly `localhost`. */
export function endpointOrigin(
  value: string,
  host: { hostname: string; origin: string },
): string | null {
  try {
    const url = new URL(value);
    const localhostHttp =
      url.protocol === "http:" && url.hostname === "localhost" && host.hostname === "localhost";
    if (
      (url.protocol !== "https:" && !localhostHttp) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      host.origin === "null"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
