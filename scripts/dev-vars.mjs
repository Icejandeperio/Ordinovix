// Writes .dev.vars with random LOCAL values for every secret named in ADR-0002 section 3.
// Usage: npm run dev:vars [-- --force] [-- --out <path>]
// Values are generated with node:crypto, written to the file and never printed. The file is gitignored; nothing in this
// repository reads it except wrangler (local dev and getPlatformProxy). Production secrets are not made here: the owner's
// setup script generates and sets those, distinct per environment.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
const out = outIndex > -1 ? args[outIndex + 1] : '.dev.vars';
if (!out) {
  console.error('--out needs a path');
  process.exit(2);
}

if (existsSync(out) && !force) {
  console.error(`${out} already exists. Run again with --force to replace it (the old values are lost).`);
  process.exit(1);
}

const b64 = (bytes) => randomBytes(bytes).toString('base64');

// VAPID keys: an ECDSA P-256 pair. Public = uncompressed point (0x04 || x || y), private = the scalar d, both base64url.
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const priv = privateKey.export({ format: 'jwk' });
const pub = publicKey.export({ format: 'jwk' });
const vapidPublic = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');

const values = {
  // Not secret, but the dev sign-in route needs both this and APP_ENV=local (ADR-0002 section 3)
  DEV_AUTH: '1',
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
  // The Google provider is stubbed in tests and not used by dev sign-in; these only let the config load
  GOOGLE_CLIENT_ID: `local-${randomBytes(8).toString('hex')}.apps.googleusercontent.invalid`,
  GOOGLE_CLIENT_SECRET: randomBytes(24).toString('base64url'),
  VAPID_PUBLIC_KEY: vapidPublic,
  VAPID_PRIVATE_KEY: priv.d,
  FILE_URL_SIGNING_KEY: b64(32),
  TIN_ENCRYPTION_KEY: b64(32),
};

writeFileSync(out, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
console.log(`Wrote ${out} with: ${Object.keys(values).join(', ')}`);
console.log('Values are random and local to this machine; they are not shown here.');
