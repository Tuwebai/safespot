import { useQuery } from '@tanstack/react-query'

export interface HeatmapFeature {
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number] // [lng, lat]
    }
    properties: {
        id: string
        type: string
        created_at: string
        intensity: number
    }
}

export interface HeatmapData {
    type: 'FeatureCollection'
    features: HeatmapFeature[]
}

export const useAdminHeatmap = () => {
    return useQuery<HeatmapData>({
        queryKey: ['admin', 'heatmap'],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            if (!token) throw new Error('No admin token')

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/heatmap`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!res.ok) {
                throw new Error('Failed to fetch heatmap data')
            }

            return res.json()
        },
        staleTime: 60000 * 5, // Cache for 5 mins
    })
}
