import { mockRepositories, mockDevControls } from './mock';
import type { Repositories } from './repositories';

const isMock = import.meta.env.VITE_DATA_SOURCE !== 'api';

export const repositories: Repositories = isMock ? mockRepositories : mockRepositories;
export const devControls = mockDevControls;
