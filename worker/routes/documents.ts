/**
 * Document routes (BACKEND_PLAN 4.6). Upload and replace take multipart form data, check the type by content (PDF, PNG, JPEG,
 * WebP, HEIC), the size (15 MB), compute the SHA-256 themselves, and store the bytes in R2 under a key that is never reused;
 * the metadata, the line change and the activity go to D1 in one batch (runWrite). Viewing and downloading mint a 5-minute
 * HMAC-signed URL and log the event; the bucket is never public.
 */
import { Hono, type Context } from 'hono';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { ifMatchVersion, runWrite } from '../db/persist';
import type { AppEnv } from '../env';
import { MAX_FILE_BYTES, MAX_THUMB_BYTES, createR2Files, sha256Hex, sniffType, verifyFileUrl } from '../files/store';
import { readBody, text } from '../lib/body';

export const documentRoutes = new Hono<AppEnv>();

const META = ['clientId', 'taskId', 'lineId', 'visitItemId', 'paymentId', 'authorizationId', 'kind', 'source'] as const;
const INFO = ['originalName', 'originalSizeBytes', 'pageCount'] as const;
const FORM = ['meta', 'file', 'thumb', 'info'] as const;

const json = (value: unknown, field: string, allowed: readonly string[]): Record<string, any> => {
  if (value === undefined || value === null || value === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value));
  } catch {
    throw new ValidationError({ [field]: [`${field} must be a JSON object`] });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ValidationError({ [field]: [`${field} must be a JSON object`] });
  const unknown = Object.keys(parsed).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw new ValidationError(Object.fromEntries(unknown.map((k) => [`${field}.${k}`, ['This field is not accepted here']])));
  return parsed as Record<string, any>;
};

/** Reads a checked upload from the form: the file with its real type and hash, the optional thumbnail, the metadata. */
async function readUpload(c: Context<AppEnv>, withMeta: boolean) {
  const length = Number(c.req.header('content-length') ?? 0);
  if (length > MAX_FILE_BYTES + MAX_THUMB_BYTES + 64 * 1024) throw new ValidationError({ file: ['Files can be 15 MB at most'] });
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ValidationError({ body: ['Send multipart form data with a file field'] });
  }
  const unknown = [...new Set([...form.keys()])].filter((k) => !(FORM as readonly string[]).includes(k));
  if (unknown.length > 0) throw new ValidationError(Object.fromEntries(unknown.map((k) => [k, ['This field is not accepted here']])));

  const raw = form.get('file');
  if (!(raw instanceof File)) throw new ValidationError({ file: ['Attach the file in the "file" field'] });
  if (raw.size === 0) throw new ValidationError({ file: ['This file is empty'] });
  if (raw.size > MAX_FILE_BYTES) throw new ValidationError({ file: ['Files can be 15 MB at most'] });
  const bytes = new Uint8Array(await raw.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) throw new ValidationError({ file: ['This file type is not accepted. Use a PDF, PNG, JPEG, WebP or HEIC file.'] });
  if (raw.type && raw.type !== type && !(type === 'image/heic' && /^image\/hei[cf]/.test(raw.type))) {
    throw new ValidationError({ file: ['The content of this file does not match its type'] });
  }
  const file = new Blob([bytes], { type });

  let thumb: Blob | undefined;
  const rawThumb = form.get('thumb');
  if (rawThumb instanceof File && rawThumb.size > 0) {
    if (rawThumb.size > MAX_THUMB_BYTES) throw new ValidationError({ thumb: ['A thumbnail can be 1 MB at most'] });
    const tb = new Uint8Array(await rawThumb.arrayBuffer());
    const tt = sniffType(tb);
    if (!tt || !tt.startsWith('image/')) throw new ValidationError({ thumb: ['A thumbnail must be an image'] });
    thumb = new Blob([tb], { type: tt });
  }

  const info = json(form.get('info'), 'info', INFO);
  // the hash is ours: whatever the browser computed is not trusted
  const sha256 = await sha256Hex(bytes);
  return {
    meta: withMeta ? json(form.get('meta'), 'meta', META) : {},
    file,
    thumb,
    info: { originalName: info.originalName ?? raw.name, originalSizeBytes: info.originalSizeBytes ?? raw.size, pageCount: info.pageCount, sha256 },
  };
}

async function withFiles<T>(c: Context<AppEnv>, run: (files: ReturnType<typeof createR2Files>) => Promise<T>): Promise<T> {
  const files = createR2Files(c.env);
  try {
    return await run(files);
  } catch (error) {
    await files.discard(); // the batch did not happen: take back what we put in the bucket
    throw error;
  }
}

documentRoutes.post('/documents', async (c) => {
  const { meta, file, thumb, info } = await readUpload(c, true);
  return withFiles(c, (files) => runWrite(c, { status: 201, files, run: (cmd) => cmd.documents.upload(meta as never, file, thumb, info) }));
});

documentRoutes.post('/documents/:id/replace', async (c) => {
  const { file, thumb, info } = await readUpload(c, false);
  return withFiles(c, (files) => runWrite(c, { status: 201, files, run: (cmd) => cmd.documents.replace(c.req.param('id'), file, thumb, info) }));
});

documentRoutes.patch('/documents/:id', async (c) => {
  const body = await readBody(c, ['kind', 'lineId', 'taskId']);
  return runWrite(c, { run: (cmd) => cmd.documents.update(c.req.param('id'), { ...body, version: ifMatchVersion(c) }) });
});

documentRoutes.delete('/documents/:id', async (c) => {
  const body = await readBody(c, ['reason']);
  return runWrite(c, { run: (cmd) => cmd.documents.remove(c.req.param('id'), text(body.reason, 'reason')) });
});

/** GET /files/:id?purpose=view|download|thumb: a signed URL for the file, valid 5 minutes. The view is logged. */
documentRoutes.get('/files/:id', async (c) => {
  const purpose = (c.req.query('purpose') ?? 'view') as 'view' | 'download' | 'thumb';
  if (!['view', 'download', 'thumb'].includes(purpose)) throw new ValidationError({ purpose: ['purpose must be view, download or thumb'] });
  return runWrite(c, {
    idempotent: false,
    files: createR2Files(c.env),
    run: (cmd) => cmd.documents.getUrl(c.req.param('id'), purpose),
    respond: (url) => ({ url, expiresInSeconds: 300 }),
  });
});

/**
 * GET /files/:id/content?purpose&exp&sig: the bytes, for a URL minted above. No cookie is needed (an <img> or a download link
 * carries only the URL), so this route sits outside the signed-in group; the signature is the proof. Never cached.
 */
export const fileContent = new Hono<AppEnv>();
fileContent.get('/api/v1/files/:id/content', async (c) => {
  const id = c.req.param('id');
  const { purpose = 'view', exp, sig } = c.req.query();
  if (!['view', 'download', 'thumb'].includes(purpose) || !(await verifyFileUrl(c.env.FILE_URL_SIGNING_KEY, id, purpose, exp, sig))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'This link has expired or is not valid. Open the file again from the app.' } }, 403);
  }
  const doc = await c.env.DB.prepare('SELECT display_name, mime_type, storage_key, thumbnail_key, deleted_at FROM documents WHERE id = ?').bind(id).first<{
    display_name: string;
    mime_type: string;
    storage_key: string;
    thumbnail_key: string | null;
    deleted_at: string | null;
  }>();
  if (!doc || doc.deleted_at || doc.storage_key.startsWith('data:') || doc.storage_key.startsWith('purged:')) throw new NotFoundError('File not found');
  const key = purpose === 'thumb' && doc.thumbnail_key ? doc.thumbnail_key : doc.storage_key;
  const object = await c.env.FILES.get(key);
  if (!object) throw new NotFoundError('File not found');
  const type = key === doc.thumbnail_key ? object.httpMetadata?.contentType ?? 'image/jpeg' : doc.mime_type;
  return new Response(object.body, {
    headers: {
      'content-type': type,
      'content-length': String(object.size),
      'cache-control': 'private, max-age=0',
      'content-disposition': `${purpose === 'download' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.display_name)}`,
    },
  });
});
