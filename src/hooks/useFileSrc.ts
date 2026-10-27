import { useEffect, useState } from 'react';
import { getFileUrl, isStoredFileKey } from '@/lib/files';

/**
 * Turns a document's storage key into something an <img>, <a> or <iframe> can load.
 * Files kept on this device (idb: keys) get a fresh object URL that is revoked when the view goes away;
 * seeded documents keep their data: URL. Returns undefined until the URL is ready.
 */
export function useFileSrc(storageKey?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(
    storageKey && !isStoredFileKey(storageKey) ? storageKey : undefined
  );

  useEffect(() => {
    if (!storageKey) {
      setSrc(undefined);
      return;
    }
    if (!isStoredFileKey(storageKey)) {
      setSrc(storageKey);
      return;
    }
    let cancelled = false;
    let minted: string | undefined;
    setSrc(undefined);
    getFileUrl(storageKey)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
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
      if (minted) URL.revokeObjectURL(minted);
    };
  }, [storageKey]);

  return src;
}
