// Internal implementation. Deep imports from other modules are blocked by lint.
import type { CoachTransport, CoachTransportResult } from './session.ts';

/**
 * Browser transport: POSTs the mode + history + memory + config to the
 * same-origin coach proxy (Vite dev plugin in dev, the Vercel function in
 * prod). No API key ever reaches the client bundle.
 */
export function createProxyTransport(endpoint = '/api/coach'): CoachTransport {
  return async (request) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .then((body: unknown) =>
          typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : undefined,
        )
        .catch(() => undefined);
      throw new Error(error ?? `Coach request failed (${String(response.status)})`);
    }
    return (await response.json()) as CoachTransportResult;
  };
}
