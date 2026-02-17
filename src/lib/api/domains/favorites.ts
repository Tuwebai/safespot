import { transformReport, type RawReport } from '../../adapters';
import type { Report } from '../../schemas';

type ApiRequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createFavoritesApi(apiRequest: ApiRequestFn) {
  return {
    getAll: async (): Promise<Report[]> => {
      const raw = await apiRequest<RawReport[]>('/favorites');
      return raw.map((r) => transformReport(r));
    },
  };
}
