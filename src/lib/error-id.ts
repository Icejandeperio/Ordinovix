import { toast } from 'sonner';

/** The error ID the server put on a 5xx answer (worker/errors.ts), if this error came from one. */
export function errorIdOf(error: unknown): string | undefined {
  const id = (error as { errorId?: unknown } | null)?.errorId;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/** Shows a server fault with its error ID in the text and a control that copies it. Returns false for any other error. */
export function toastServerFault(error: unknown): boolean {
  const id = errorIdOf(error);
  if (!id) return false;
  toast.error((error as Error).message, {
    duration: 15_000,
    action: {
      label: 'Copy error ID',
      onClick: () => {
        void navigator.clipboard?.writeText(id).then(
          () => toast.success('Error ID copied'),
          () => toast.message(`Error ID: ${id}`),
        );
      },
    },
  });
  return true;
}
