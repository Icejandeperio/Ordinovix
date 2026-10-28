import { createApp } from './app';

/** Worker entry (wrangler.jsonc `main`). Only /api/* reaches this code; everything else is served from the static assets. */
export default createApp();
