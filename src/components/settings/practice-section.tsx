import { useState } from 'react';
import { useSaveSettings } from '@/hooks/useData';
import { DateField } from '@/components/inputs/date-field';
import { SaveBar, INPUT_CLASS, LABEL_CLASS } from './save-bar';
import type { OrgSettings } from '@/domain/types';

interface PracticeSectionProps {
  settings: OrgSettings;
  onSaved: () => void;
}

/** Practice configuration (owner only): firm name and BIR tax agent accreditation, saved with settings.save. */
export function PracticeSection({ settings, onSaved }: PracticeSectionProps) {
  const save = useSaveSettings();
  const [practiceName, setPracticeName] = useState(settings.practiceName);
  const [accreditationNo, setAccreditationNo] = useState(settings.accreditation?.number ?? '');
  const [accreditationExpiry, setAccreditationExpiry] = useState(settings.accreditation?.validUntil ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    const number = accreditationNo.trim();
    save.mutate(
      {
        version: settings.version,
        practiceName: practiceName.trim(),
        accreditation: number ? { number, validUntil: accreditationExpiry || undefined } : undefined,
      },
      { onSuccess: onSaved, onError: (err) => setError((err as Error).message) }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Practice Configuration</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Firm accreditation details, default tax operator credentials, and stationery defaults.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="practice-name" className={LABEL_CLASS}>Practice Firm Name</label>
          <input
            id="practice-name"
            type="text"
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="practice-accreditation" className={LABEL_CLASS}>BIR Tax Agent Accreditation No.</label>
            <input
              id="practice-accreditation"
              type="text"
              value={accreditationNo}
              onChange={(e) => setAccreditationNo(e.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
          </div>
          <DateField
            label="Accreditation Validity Date"
            value={accreditationExpiry}
            onChange={(val) => setAccreditationExpiry(val || '')}
            showRelativeHint={true}
          />
        </div>

        <div className="p-3 rounded-md bg-[var(--info-bg)] border border-[var(--info-bd)] text-xs text-[var(--info-fg)]">
          <strong>Accreditation Reminder:</strong> Ordinovix generates automated warning banners 60 days prior to accreditation expiry to prevent interruption of counter representation privileges.
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={save.isPending} error={error} />
    </div>
  );
}
