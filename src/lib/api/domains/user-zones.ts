type ApiRequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createUserZonesApi<TUserZone, TUserZoneData>(apiRequest: ApiRequestFn) {
  return {
    getAll: async (): Promise<TUserZone[]> => {
      return apiRequest<TUserZone[]>('/user-zones');
    },
    updateCurrent: async (lat: number, lng: number, label?: string): Promise<TUserZoneData> => {
      return apiRequest<TUserZoneData>('/user-zones/current', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, label }),
      });
    },
  };
}
