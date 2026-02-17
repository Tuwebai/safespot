type ApiRequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createSeoApi<TZoneSEO>(apiRequest: ApiRequestFn) {
  return {
    getZones: async (): Promise<TZoneSEO[]> => {
      return apiRequest<TZoneSEO[]>('/seo/zones');
    },
  };
}
