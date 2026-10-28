/**
 * Everything the Worker reads from its environment (ADR-0002 section 3). Bindings come from wrangler.jsonc; the secrets
 * are set by the owner's setup script (live) or `npm run dev:vars` (local) and are never listed in a config file.
 */
export interface AppBindings {
  DB: D1Database;
  FILES: R2Bucket;
  /** Static assets binding; present when the app is served by the Worker. */
  ASSETS?: Fetcher;
  APP_ENV: 'local' | 'preview' | 'production';
  /** Set to "1" in .dev.vars only; the dev sign-in route also requires APP_ENV=local. */
  DEV_AUTH?: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  FILE_URL_SIGNING_KEY: string;
  TIN_ENCRYPTION_KEY: string;
}

export type AppEnv = { Bindings: AppBindings };
