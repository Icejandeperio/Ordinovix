import { request } from './http';

/** The public half of the VAPID key, which the browser needs to subscribe. It is not a secret (GET /api/v1/push/vapid-key). */
export async function fetchVapidKey(): Promise<string> {
  const answer = await request<{ publicKey?: string } | undefined>('GET', '/api/v1/push/vapid-key');
  if (!answer?.publicKey) throw new Error('Reminders are not set up on the server yet.');
  return answer.publicKey;
}
