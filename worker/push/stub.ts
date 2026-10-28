import type { PushDeps } from './send';

/**
 * A push service for tests: records what would have been built and posted, and answers with the status the test chooses.
 * Nothing leaves the process; no push endpoint is ever contacted.
 */
export function stubPush(statusFor: (endpoint: string) => number = () => 201) {
  const built: Array<{ endpoint: string; payload: Record<string, unknown>; adminContact: string; options: unknown }> = [];
  const posted: Array<{ url: string; init: RequestInit }> = [];
  const deps: PushDeps = {
    build: (async (opts: { subscription: { endpoint: string }; message: { payload: Record<string, unknown>; adminContact: string; options?: unknown } }) => {
      built.push({ endpoint: opts.subscription.endpoint, payload: opts.message.payload, adminContact: opts.message.adminContact, options: opts.message.options });
      return { endpoint: opts.subscription.endpoint, headers: new Headers({ authorization: 'vapid t=stub, k=stub', 'content-encoding': 'aes128gcm' }), body: new ArrayBuffer(8) };
    }) as unknown as PushDeps['build'],
    fetch: async (url, init) => {
      posted.push({ url, init });
      return { status: statusFor(url) };
    },
  };
  return { deps, built, posted };
}
