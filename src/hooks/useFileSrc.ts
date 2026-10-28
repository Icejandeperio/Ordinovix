import { useEffect, useState } from 'react';
import { getFileUrl, needsFileLookup } from '@/lib/files';

/**
 * Turns a document's storage key into something an <img>, <a> or <iframe> can load.
 * Files kept on this device (idb: keys) get a fresh object URL that is revoked when the view goes away; files in R2 get a
 * short-lived signed URL from the API; seeded documents keep their data: URL. Returns undefined until the URL is ready.
 */
export function useFileSrc(storageKey?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(
    storageKey && !needsFileLookup(storageKey) ? storageKey : undefined
  );

  useEffect(() => {
    if (!storageKey) {
      setSrc(undefined);
      return;
    }
    if (!needsFileLookup(storageKey)) {
      setSrc(storageKey);
      return;
    }
    let cancelled = false;
    let minted: string | undefined;
    setSrc(undefined);
    getFileUrl(storageKey)
      .then((url) => {
        if (cancelled) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        minted = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(undefined);
      });
    return () => {
      cancelled = true;
      if (minted?.startsWith('blob:')) URL.revokeObjectURL(minted);
    };
  }, [storageKey]);

  return src;
}
