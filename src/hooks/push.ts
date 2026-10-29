import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { pushControls, repositories } from '@/data';
import { isMockData } from '@/lib/data-source';
import { browserPushDeps, readStatus, removeThisDevice, turnOff, turnOn, type PushDeps, type RemindersStatus } from '@/lib/push';

const MOCK_KEY = 'ox-mock-reminders';

/** The browser side from the page, the server side from the repositories. */
const deviceDeps = (): PushDeps =>
  browserPushDeps({
    vapidKey: () => pushControls.vapidKey(),
    save: (sub) => repositories.push.subscribe(sub),
    remove: (endpoint) => repositories.push.unsubscribe(endpoint),
  });

/** Sign-out (spec 19.5): this device stops getting reminders for the person leaving. Never throws. */
export const removeThisDevicePush = (): Promise<void> => removeThisDevice(deviceDeps());

const readMock = (): boolean => {
  try {
    return window.localStorage.getItem(MOCK_KEY) === 'true';
  } catch {
    return false;
  }
};
const writeMock = (on: boolean): void => {
  try {
    window.localStorage.setItem(MOCK_KEY, String(on));
  } catch {
    // storage unavailable: the preview lasts until the page reloads
  }
};

/**
 * "Turn on reminders" for this device. Against the API it is the real thing (permission, subscription, saved on the server);
 * the mock has no push service, so it pretends and shows a "Push preview" toast (spec 14).
 */
export function useReminders() {
  const deps = useMemo(deviceDeps, []);
  const [status, setStatus] = useState<RemindersStatus | 'checking'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isMockData) {
      setStatus(readMock() ? 'on' : 'off');
      return;
    }
    let live = true;
    readStatus(deps)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus('unsupported'));
    return () => {
      live = false;
    };
  }, [deps]);

  const run = useCallback(async (action: () => Promise<RemindersStatus>) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await action());
    } catch (e) {
      setError((e as Error).message || 'Could not change reminders on this device. Try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  const on = useCallback(
    () =>
      run(async () => {
        if (!isMockData) return turnOn(deps);
        await repositories.push.subscribe({ endpoint: 'ordinovix://browser-push' });
        writeMock(true);
        toast('Push preview: a reminder would reach this phone like this.');
        return 'on';
      }),
    [deps, run],
  );

  const off = useCallback(
    () =>
      run(async () => {
        if (!isMockData) return turnOff(deps);
        await repositories.push.unsubscribe('ordinovix://browser-push');
        writeMock(false);
        return 'off';
      }),
    [deps, run],
  );

  return { status, busy, error, turnOn: on, turnOff: off };
}
