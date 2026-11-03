import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';
import { VersionConflictError } from '@/domain/errors';

// U38: the next action says who acts next, so an edit made from an older version of the task is refused, like the other task edits.
describe('U38 tasks.setNextAction carries the task version', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('a stale version is a conflict that carries the current task, and changes nothing', async () => {
    const id = 'task-rsp-0619e';
    const loadedVersion = (await R.tasks.get(id)).task.version; // the mock hands out live records: keep the number
    await R.tasks.setNextAction(id, { text: 'Newer', owner: 'operator' }, loadedVersion);
    await expect(R.tasks.setNextAction(id, { text: 'Older', owner: 'operator' }, loadedVersion)).rejects.toBeInstanceOf(VersionConflictError);
    expect((await R.tasks.get(id)).task.nextAction?.text).toBe('Newer');
  });

  it('the current version goes through and bumps the version once', async () => {
    const id = 'task-rsp-0619e';
    const loadedVersion = (await R.tasks.get(id)).task.version;
    const saved = await R.tasks.setNextAction(id, { text: 'Call the client', owner: 'operator' }, loadedVersion);
    expect(saved.version).toBe(loadedVersion + 1);
  });
});
