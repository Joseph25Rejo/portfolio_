// Cloudflare Pages Functions entry for /api/*.
// The same handlers also run as a Worker (see worker.js and wrangler.jsonc).
import worker from '../../worker.js';

export const onRequest = (context) => worker.fetch(context.request, context.env);
