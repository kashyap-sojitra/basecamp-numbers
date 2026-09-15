/**
 * Reading what a component asked the network for.
 *
 * `fetch`'s own types allow a URL or a whole `Request`, and a body that may
 * be a stream or a blob. Stringifying those blindly gives "[object Object]"
 * and a test that passes for the wrong reason, so both are narrowed here
 * instead.
 */

export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function bodyOf(init: RequestInit | undefined): string {
  const body = init?.body;
  return typeof body === "string" ? body : "";
}

/** The parsed JSON body of a request, for asserting on a payload. */
export function jsonBodyOf(init: RequestInit | undefined): unknown {
  const body = bodyOf(init);
  return body === "" ? null : JSON.parse(body);
}
