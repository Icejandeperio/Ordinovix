import imageCompression from 'browser-image-compression';
import type { DocumentKind } from '@/domain/types';

/**
 * 9.8 Compute SHA-256 hash using Web Crypto API
 */
export async function computeSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 9.8 Format human-readable bytes
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 9.8 Image compression pipeline
 * Longest side 2000px, WebP format, target <= 600KB, maintain orientation
 */
export async function compressImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{
  file: File | Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}> {
  const originalSize = file.size;

  // Don't compress non-images or already small images (< 400 KB)
  if (!file.type.startsWith('image/') || originalSize <= 400 * 1024) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    };
  }

  const options = {
    maxSizeMB: 0.6, // target <= 600 KB
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
    onProgress,
  };

  try {
    const compressed = await imageCompression(file, options);
    const compressedSize = compressed.size;
    return {
      file: compressed,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
    };
  } catch (err) {
    // Fallback gracefully if WebWorker or compression fails
    console.warn('Image compression fallback:', err);
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    };
  }
}

/**
 * 9.8 Generate 320px WebP thumbnail
 */
export async function createThumbnail(file: Blob, mimeType: string): Promise<Blob> {
  if (!mimeType.startsWith('image/')) {
    // Return empty blob for non-images (handled via icon in UI)
    return new Blob([], { type: 'application/pdf' });
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const maxDim = 320;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          'image/webp',
          0.75
        );
      } else {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * 9.9 Standardized document naming convention
 * {CLIENTCODE}_{TEMPLATECODE}_{PERIOD}_{KIND}_v{N}.{ext}
 */
const KIND_SLUGS: Record<DocumentKind, string> = {
  source: 'src',
  filed_return: 'return',
  acknowledgment: 'ack',
  payment_proof: 'payproof',
  stamped_copy: 'stamped',
  ecar: 'ecar',
  authorization: 'auth',
  other: 'other',
};

export function formatStandardizedDocName({
  clientCode,
  templateCode,
  period,
  kind,
  version = 1,
  ext = 'pdf',
}: {
  clientCode: string;
  templateCode?: string;
  period?: string;
  kind: DocumentKind;
  version?: number;
  ext: string;
}): string {
  const parts: string[] = [clientCode.toUpperCase()];
  if (templateCode) parts.push(templateCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
  if (period) parts.push(period.replace(/[^a-zA-Z0-9-]/g, ''));
  parts.push(KIND_SLUGS[kind] || 'doc');
  parts.push(`v${version}`);

  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'pdf';
  return `${parts.join('_')}.${cleanExt}`;
}
