import type { GeocodeResult } from '../../schemas';

type ApiRequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createGeocodeApi(apiRequest: ApiRequestFn) {
  return {
    reverse: async (lat: number, lng: number): Promise<GeocodeResult> => {
      return apiRequest<GeocodeResult>(`/geocode/reverse?lat=${lat}&lng=${lng}`);
    },
    getByIp: async (): Promise<GeocodeResult> => {
      return apiRequest<GeocodeResult>('/geocode/ip');
    },
  };
}
