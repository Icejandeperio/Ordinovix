/** Mock mode is everything except an explicit `api` data source. Dev tools and sample-data UI render only in mock mode. */
export const isMockDataSource = (source: string | undefined): boolean => source !== 'api';

export const isMockData = isMockDataSource(import.meta.env.VITE_DATA_SOURCE);
