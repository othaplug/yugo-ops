/**
 * fetch with an upper bound on wait time. Clears the timer when the request settles.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  timeoutMs: number,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => {
    ctrl.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
