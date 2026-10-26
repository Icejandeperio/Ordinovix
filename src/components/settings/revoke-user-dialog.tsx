import React, { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';
import type { Membership } from '@/domain/types';

interface RevokeUserDialogProps {
  open: boolean;
  onClose: () => void;
  membership: (Membership & { name?: string }) | null;
  onConfirm: () => Promise<void>;
  isPending?: boolean;
}

export function RevokeUserDialog({
  open,
  onClose,
  membership,
  onConfirm,
  isPending = false,
}: RevokeUserDialogProps) {
  const lastMembershipRef = useRef(membership);
  if (membership) {
    lastMembershipRef.current = membership;
  }
  const activeMembership = membership || lastMembershipRef.current;
  const displayName = activeMembership ? activeMembership.name || activeMembership.email : '';

  return (
    <ModalDialog
      open={Boolean(open && membership)}
      onClose={onClose}
      maxWidth="max-w-[460px]"
      ariaLabel="Revoke Operator Access"
    >
      {activeMembership && (
        <>
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--destructive-light, #fee2e2)',
              color: 'var(--destructive, #dc2626)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="revoke-dialog-title"
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Revoke Operator Access
            </h3>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                margin: '4px 0 0 0',
              }}
            >
              Confirm removing access for this practice operator.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: 'var(--space-1)',
              background: 'transparent',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-6)' }}>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              margin: '0 0 var(--space-4) 0',
            }}
          >
            Are you sure you want to revoke access for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong> (
            <code>{activeMembership.email}</code>)?
          </p>

          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--surface-secondary, #f8fafc)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}
          >
            <span>• Their active session will be invalidated immediately.</span>
            <span>• They will no longer have access to client records or tax filings.</span>
            <span>• You can reactivate their account at any time from this console.</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            backgroundColor: 'var(--surface-secondary, #f8fafc)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-primary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={isPending}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'var(--destructive, #dc2626)',
              color: '#ffffff',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {isPending ? 'Revoking...' : 'Revoke Access'}
          </button>
        </div>
        </>
      )}
    </ModalDialog>
  );
}
