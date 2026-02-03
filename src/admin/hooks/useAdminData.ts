import { useQuery } from '@tanstack/react-query'

interface AdminStats {
    kpis: {
        activeUsers: number
        newReports: number
        riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL'
        riskMessage: string
        systemStatus: string
    }
    recentActivity: {
        id: string
        title: string
        created_at: string
        report_type: string
        anonymous_id: string
    }[]
}

export const useAdminStats = () => {
    return useQuery<AdminStats>({
        queryKey: ['admin', 'stats'],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            if (!token) throw new Error('No admin token')

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!res.ok) {
                throw new Error('Failed to fetch admin stats')
            }

            return res.json()
        },
        refetchInterval: 30000, // Refresh every 30s
    })
}
