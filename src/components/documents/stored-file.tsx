import type { ReactNode } from 'react';
import { useFileSrc } from '@/hooks/useFileSrc';

/** An <img> for a stored document: waits for the object URL instead of pointing at a dead key. */
export function StoredImage({ storageKey, alt, className }: { storageKey: string; alt: string; className?: string }) {
  const src = useFileSrc(storageKey);
  if (!src) return <div className={className} aria-busy="true" />;
  return <img src={src} alt={alt} className={className} />;
}

/** A link to a stored document's file: opens it in a new tab, or saves it when `download` is set. */
export function StoredFileLink({
  storageKey,
  className,
  download,
  title,
  children,
}: {
  storageKey: string;
  className?: string;
  /** Set to save the file under this name instead of opening it. */
  download?: string;
  title?: string;
  children: ReactNode;
}) {
  const src = useFileSrc(storageKey);
  return (
    <a
      href={src}
      download={download}
      target={download ? undefined : '_blank'}
      rel="noreferrer"
      className={className}
      title={title}
      aria-disabled={!src}
    >
      {children}
    </a>
  );
}
