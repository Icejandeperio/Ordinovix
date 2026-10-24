import { v7 as uuidv7 } from 'uuid';
import type { ID } from '@/domain/types';

/**
 * Generates time-ordered UUIDv7 for offline-safe unique keys.
 */
export function generateId(): ID {
  return uuidv7();
}
