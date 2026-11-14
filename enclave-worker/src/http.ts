export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/** `fetch` with a hard timeout so a slow upstream cannot pin a request handler forever. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}
