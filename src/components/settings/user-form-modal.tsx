import React, { useState, useEffect } from 'react';
import { X, Shield, User, Check, Search, AlertCircle } from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';
import type { Membership, Role, ID } from '@/domain/types';
import type { ClientSummary } from '@/domain/types';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  membership?: (Membership & { name?: string }) | null;
  clients: ClientSummary[];
  onSave: (data: {
    email: string;
    name: string;
    role: Role;
    clientIds: ID[];
    note?: string;
  }) => Promise<void>;
}

export function UserFormModal({
  open,
  onClose,
  membership,
  clients,
  onSave,
}: UserFormModalProps) {
  const isEditing = Boolean(membership);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('helper');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (membership) {
      setEmail(membership.email);
      setName(membership.name || membership.email.split('@')[0]);
      setRole(membership.role);
      setSelectedClientIds(membership.clientIds || []);
      setNote('');
    } else {
      setEmail('');
      setName('');
      setRole('helper');
      setSelectedClientIds([]);
      setNote('');
    }
    setError(null);
    setClientSearch('');
  }, [membership, open]);


  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAllClients = () => {
    setSelectedClientIds(clients.map((c) => c.client.id));
  };

  const clearAllClients = () => {
    setSelectedClientIds([]);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.client.code.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.client.displayName.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('A valid Google account email is required.');
      return;
    }
    if (!trimmedName) {
      setError('Please provide the full name for this operator.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        email: trimmedEmail,
        name: trimmedName,
        role,
        clientIds: role === 'owner' ? [] : selectedClientIds,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save operator account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      ariaLabel={isEditing ? 'Edit Operator Permissions' : 'Add Practice Operator'}
    >
        <div className="flex items-center justify-between p-4 border-b border-[var(--rule)] bg-[var(--sheet-2)]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--stamp)]" />
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {isEditing ? 'Edit Operator Permissions' : 'Add Practice Operator'}
              </h3>
              <p className="text-[11px] text-[var(--ink-3)]">
                {isEditing
                  ? `Update role and client assignments for ${membership?.email}`
                  : 'Authorize a Google account to access your Ordinovix workspace.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--sheet)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[var(--critical-bg)] text-[var(--critical-fg)] border border-[var(--critical-bd)] text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
              Google Account Email <span className="text-[var(--critical-fg)]">*</span>
            </label>
            <input
              type="email"
              value={email}
              disabled={isEditing}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. maria.santos@gmail.com"
              className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
              required
            />
            <p className="text-[11px] text-[var(--ink-3)] mt-1">
              Must match the email address the operator uses to sign in via Google OAuth.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
              Full Name <span className="text-[var(--critical-fg)]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria Santos"
              className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-2">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('helper')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer select-none ${
                  role === 'helper'
                    ? 'border-[var(--info-bd)] bg-[var(--info-bg)] text-[var(--info-fg)]'
                    : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)] hover:border-[var(--rule-strong)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider">Helper (Scoped)</div>
                  {role === 'helper' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[11px] opacity-80 leading-snug">
                  Restricted to assigned clients. Can upload docs, prepare filings, and attend visits.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('owner')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer select-none ${
                  role === 'owner'
                    ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                    : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)] hover:border-[var(--rule-strong)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider">Owner (Super Admin)</div>
                  {role === 'owner' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[11px] opacity-80 leading-snug">
                  Full practice authority. Can manage users, billing, templates, and view all clients.
                </div>
              </button>
            </div>
          </div>

          {role === 'helper' && (
            <div className="space-y-2 pt-2 border-t border-[var(--rule)]">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                    Assigned Clients ({selectedClientIds.length} of {clients.length})
                  </label>
                  <p className="text-[11px] text-[var(--ink-3)]">
                    Helper will only see tasks, filings, and visits for selected clients.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllClients}
                    className="text-[11px] font-semibold text-[var(--stamp)] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-[var(--ink-3)] text-xs">·</span>
                  <button
                    type="button"
                    onClick={clearAllClients}
                    className="text-[11px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--ink-3)]" />
                <input
                  type="text"
                  placeholder="Filter clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--stamp)]"
                />
              </div>

              <div className="max-h-40 overflow-y-auto border border-[var(--rule)] rounded-md divide-y divide-[var(--rule)] bg-[var(--sheet)]">
                {filteredClients.map(({ client }) => {
                  const isChecked = selectedClientIds.includes(client.id);
                  return (
                    <label
                      key={client.id}
                      className="flex items-center gap-2.5 p-2 text-xs hover:bg-[var(--sheet-2)] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleClient(client.id)}
                        className="w-3.5 h-3.5 accent-[var(--stamp)] rounded"
                      />
                      <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)] text-[10px] text-[var(--stamp)]">
                        {client.code}
                      </span>
                      <span className="truncate text-[var(--ink)]">{client.displayName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
              Administrative Note (Optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Authorized helper assisting with Q4 tax compliance and BIR visits."
              className="w-full p-2.5 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--stamp)] resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-md border border-[var(--rule)] text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--sheet-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-bold hover:bg-[var(--stamp-strong)] transition-colors disabled:opacity-50"
            >
              <User className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Invite Operator'}</span>
            </button>
          </div>
        </form>
    </ModalDialog>
  );
}
