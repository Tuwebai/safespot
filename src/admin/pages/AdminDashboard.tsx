import { Users, AlertTriangle, Activity, TrendingUp, MapPin } from 'lucide-react'
import { useAdminStats } from '../hooks/useAdminData'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import AdminMap from '../components/AdminMap'
import { useNavigate } from 'react-router-dom'
import { getAvatarUrl } from '@/lib/avatar'

export function AdminDashboard() {
    const { data, isLoading } = useAdminStats()
    const navigate = useNavigate()

    if (isLoading) {
        return (
            <div className="p-4 lg:p-8 text-[#00ff88] animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-24 bg-[#0f172a] rounded-xl border border-[#1e293b] animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px] lg:h-[600px]">
                    <div className="lg:col-span-2 bg-[#0f172a] rounded-xl border border-[#1e293b] animate-pulse" />
                    <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] animate-pulse" />
                </div>
            </div>
        )
    }

    const { kpis, recentActivity } = data || { kpis: {}, recentActivity: [] }



    return (
        <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Active Users (1h)"
                    value={kpis?.activeUsers}
                    change="Real-time"
                    icon={Users}
                    color="green"
                />
                <KPICard
                    title="New Reports (24h)"
                    value={kpis?.newReports}
                    change="Daily Volume"
                    icon={TrendingUp}
                    color="orange"
                />
                <KPICard
                    title="Risk Level"
                    value={kpis?.riskLevel}
                    change={kpis?.riskMessage}
                    icon={AlertTriangle}
                    color={kpis?.riskLevel === 'CRITICAL' ? 'red' : kpis?.riskLevel === 'MODERATE' ? 'orange' : 'green'}
                />
                <KPICard
                    title="System Status"
                    value={kpis?.systemStatus}
                    change="Optimal"
                    icon={Activity}
                    color="green"
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[600px]">

                {/* Central Map (Live Implementation) */}
                <div className="lg:col-span-2 bg-[#0f172a] rounded-xl border border-[#1e293b] p-1 flex flex-col relative overflow-hidden group min-h-[300px] lg:min-h-[400px]">
                    {/* Header Overlay */}
                    <div className="absolute top-4 left-4 z-[401] bg-[#0f172a]/90 backdrop-blur px-4 py-2 rounded-lg border border-[#334155] shadow-xl">
                        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#00ff88]" />
                            Live Heatmap
                        </h3>
                        <div className="flex gap-2 text-[10px] mt-1">
                            <span className="text-green-400 font-mono flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                ONLINE
                            </span>
                        </div>
                    </div>

                    {/* The Map */}
                    <div className="flex-1 rounded-lg overflow-hidden w-full h-full">
                        <AdminMap />
                    </div>
                </div>

                {/* Right Live Feed */}
                <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] p-4 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center justify-between">
                        Live Feed
                        <span className="h-2 w-2 rounded-full bg-[#00ff88] animate-pulse"></span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {recentActivity?.map((activity: any) => (
                            <div
                                key={activity.id}
                                onClick={() => navigate(`/admin/reports/${activity.id}`)}
                                className="bg-[#1e293b]/50 p-3 rounded-lg border border-[#334155]/50 hover:bg-[#1e293b] transition-colors cursor-pointer group hover:border-[#00ff88]/30"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-[#1e293b] border border-[#334155] overflow-hidden">
                                            <img
                                                src={activity.anonymous_users?.avatar_url || getAvatarUrl(activity.anonymous_id)}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <span className="text-xs font-mono text-slate-400">
                                            {activity.anonymous_users?.alias || (activity.anonymous_id ? activity.anonymous_id.substring(0, 8) : 'ANON')}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-500/20 text-blue-400 uppercase`}>
                                        {activity.category || activity.report_type || 'INCIDENT'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 font-medium truncate group-hover:text-white transition-colors pl-8">
                                    {activity.title}
                                </p>
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>{dateToNow(activity.created_at)}</span>
                                </div>
                            </div>
                        ))}
                        {recentActivity?.length === 0 && (
                            <div className="text-center text-slate-500 py-10">
                                No recent activity
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper to safely format date
function dateToNow(dateStr: string) {
    try {
        return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
    } catch (e) {
        return 'recently'
    }
}

// Simple Helper Component for KPI Cards
function KPICard({ title, value, change, icon: Icon, color }: any) {
    const colors = {
        green: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/20',
        orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
    }
    const colorClass = colors[color as keyof typeof colors] || colors.green

    return (
        <div className={`p-4 rounded-xl border bg-[#0f172a] border-[#1e293b] hover:border-[#334155] transition-all group`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{value}</span>
                <span className={`text-xs ${color === 'red' ? 'text-red-400' : 'text-[#00ff88]'}`}>
                    {change}
                </span>
            </div>
        </div>
    )
}
