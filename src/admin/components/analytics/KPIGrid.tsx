/**
 * ============================================================================
 * KPI GRID - Tarjetas de métricas principales
 * ============================================================================
 */

import { Users, Activity, TrendingUp, Clock, FileText, MessageSquare, ThumbsUp } from 'lucide-react';
import { formatNumber, formatPercent, formatDuration } from '../../hooks/useAnalyticsAdmin';

interface KPI {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red';
  subtitle?: string;
}

interface KPIGridProps {
  kpis: {
    dau_yesterday: number;
    mau: number;
    stickiness: number;
    total_reports: number;
    total_comments: number;
    total_votes: number;
    avg_session_duration_seconds: number;
  };
}

export function KPIGrid({ kpis }: KPIGridProps) {
  const kpiList: KPI[] = [
    {
      label: 'DAU Ayer',
      value: formatNumber(kpis.dau_yesterday),
      icon: Users,
      color: 'green',
      subtitle: 'Usuarios activos'
    },
    {
      label: 'MAU',
      value: formatNumber(kpis.mau),
      icon: Activity,
      color: 'blue',
      subtitle: '30 días'
    },
    {
      label: 'Stickiness',
      value: formatPercent(kpis.stickiness),
      icon: TrendingUp,
      color: kpis.stickiness >= 0.15 ? 'green' : kpis.stickiness >= 0.10 ? 'orange' : 'red',
      subtitle: kpis.stickiness >= 0.15 ? 'Sano' : kpis.stickiness >= 0.10 ? 'Regular' : 'Bajo'
    },
    {
      label: 'Avg Session',
      value: formatDuration(kpis.avg_session_duration_seconds),
      icon: Clock,
      color: 'purple',
      subtitle: 'Duración promedio'
    }
  ];

  const secondaryKpis: KPI[] = [
    {
      label: 'Reports',
      value: formatNumber(kpis.total_reports),
      icon: FileText,
      color: 'orange'
    },
    {
      label: 'Comments',
      value: formatNumber(kpis.total_comments),
      icon: MessageSquare,
      color: 'blue'
    },
    {
      label: 'Votes',
      value: formatNumber(kpis.total_votes),
      icon: ThumbsUp,
      color: 'green'
    }
  ];

  const getColorClasses = (color: KPI['color']) => {
    const colors = {
      green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      red: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return colors[color];
  };

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiList.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm">{kpi.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
                {kpi.subtitle && (
                  <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg border ${getColorClasses(kpi.color)}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs secundarios (producto) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {secondaryKpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#0f172a]/50 border border-[#1e293b] rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${getColorClasses(kpi.color)}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-slate-400 text-xs">{kpi.label}</p>
                <p className="text-xl font-semibold text-white">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
