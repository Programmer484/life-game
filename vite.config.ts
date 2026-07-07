import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleCoachChat } from './src/modules/coach/index.ts';

/**
 * Dev-only same-origin proxy for the coach chat. The key is read WITHOUT the
 * VITE_ prefix so Vite never bundles it into the client; production uses the
 * Vercel function at api/coach.ts instead.
 */
function coachDevProxy(apiKey: string | undefined): Plugin {
  return {
    name: 'coach-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/coach', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        let raw = '';
        req.on('data', (chunk: Buffer) => {
          raw += chunk.toString();
        });
        req.on('end', () => {
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            body = undefined;
          }
          void handleCoachChat(body, apiKey).then((result) => {
            res.statusCode = result.status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result.body));
          });
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiKey =
    loadEnv(mode, process.cwd(), '')['ANTHROPIC_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'];
  return { plugins: [coachDevProxy(apiKey)] };
});
