import React, { useState } from 'react';
import type { Office, OfficeType } from '@/domain/types';
import { useSaveOffice } from '@/hooks/useData';
import { X, Building2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface OfficeFormModalProps {
  office?: Office | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (saved: Office) => void;
}

export function OfficeFormModal({
  office,
  isOpen,
  onClose,
  onSuccess,
}: OfficeFormModalProps) {
  const saveMutation = useSaveOffice();

  const [type, setType] = useState<OfficeType>(office?.type || 'rdo');
  const [name, setName] = useState(office?.name || '');
  const [rdoCode, setRdoCode] = useState(office?.rdoCode || '');
  const [address, setAddress] = useState(office?.address || '');
  const [mapUrl, setMapUrl] = useState(office?.mapUrl || '');
  const [hours, setHours] = useState(office?.hours || '8:00 AM – 5:00 PM');
  const [phoneE164, setPhoneE164] = useState(office?.phoneE164 || '');
  const [tips, setTips] = useState(office?.tips || '');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Office name is required');
      return;
    }

    try {
      const saved = await saveMutation.mutateAsync({
        id: office?.id,
        type,
        name: name.trim(),
        rdoCode: type === 'rdo' ? rdoCode.trim() : undefined,
        address: address.trim() || undefined,
        mapUrl: mapUrl.trim() || undefined,
        hours: hours.trim() || undefined,
        phoneE164: phoneE164.trim() || undefined,
        tips: tips.trim() || undefined,
      });

      toast.success(office ? 'Office updated' : 'Office created');
      if (onSuccess) onSuccess(saved);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save office');
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-paper border border-rule rounded-panel shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-stamp" />
            <h3 className="text-base font-bold text-ink">
              {office ? 'Edit Office' : 'Add New Office'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-ink">Office Type (Required)</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OfficeType)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
                <option value="rdo">BIR RDO District Office</option>
                <option value="bank">Authorized Agent Bank (AAB)</option>
                <option value="lgu">City / Municipal Hall (LGU)</option>
                <option value="sec">Securities & Exchange Commission</option>
                <option value="client_office">Client Office</option>
                <option value="other">Other Office</option>
              </select>
            </div>

            {type === 'rdo' && (
              <div className="space-y-1">
                <label className="font-bold text-ink">RDO Code</label>
                <input
                  type="text"
                  placeholder="e.g. 039"
                  maxLength={4}
                  value={rdoCode}
                  onChange={(e) => setRdoCode(e.target.value)}
                  className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp font-mono"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-bold text-ink">Office Name (Required)</label>
            <input
              type="text"
              required
              placeholder="e.g. BIR RDO 039 - South Quezon City"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-ink">Address</label>
            <input
              type="text"
              placeholder="e.g. 1424 Quezon Ave, Diliman, Quezon City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-ink">Operating Hours</label>
              <input
                type="text"
                placeholder="e.g. 8:00 AM – 5:00 PM"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
              </input>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-ink">Phone</label>
              <input
                type="text"
                placeholder="e.g. (02) 8924-0000"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-ink">Counter Tips for Preparer</label>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="e.g. Window 5 for ONETT cut off at 3 PM. Arrive before 8:30 for early queue number."
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              className="w-full bg-sheet border border-rule rounded-control p-2 text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-4 py-1.5 font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save Office'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
