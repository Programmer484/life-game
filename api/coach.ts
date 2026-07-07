// Vercel serverless function (Web handler style) for the coach chat proxy.
// The Anthropic key lives in the platform env; it never reaches the browser.
import { handleCoachChat } from '../src/modules/coach/index.ts';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const result = await handleCoachChat(body, process.env['ANTHROPIC_API_KEY']);
  return Response.json(result.body, { status: result.status });
}
