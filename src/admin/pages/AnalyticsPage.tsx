/**
 * ============================================================================
 * ANALYTICS PAGE - Dashboard de métricas (Fase 4)
 * ============================================================================
 */

import { useState } from 'react';
import { Download, RefreshCw, Calendar, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast/useToast';
import { 
  useAnalyticsAdmin, 
  useRecalculateAnalytics,
  useExportAnalyticsCSV 
} from '../hooks/useAnalyticsAdmin';
import { KPIGrid } from '../components/analytics/KPIGrid';
import { AnalyticsChart } from '../components/analytics/AnalyticsChart';
import { DailyTable } from '../components/analytics/DailyTable';

const DAY_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 60 days' },
  { value: 90, label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { success: showSuccess } = useToast();
  
  const { data, isLoading, error, refetch } = useAnalyticsAdmin(days);
  const recalculate = useRecalculateAnalytics();
  const exportCSV = useExportAnalyticsCSV();

  const handleRefresh = () => {
    refetch();
    showSuccess('Datos actualizados');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#0f172a] rounded-xl border border-[#1e293b] animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-[#0f172a] rounded-xl border border-[#1e293b] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <Activity className="h-12 w-12 mb-4 opacity-20" />
        <p>Error loading analytics</p>
        <Button variant="outline" onClick={handleRefresh} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">
            Métricas de producto y engagement
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de días */}
          <div className="flex items-center gap-2 bg-[#0f172a] border border-[#1e293b] rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-white text-sm focus:outline-none"
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0f172a]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            onClick={() => exportCSV(days)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {data?.kpis && <KPIGrid kpis={data.kpis} />}

      {/* Chart + Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          {data?.timeSeries && (
            <AnalyticsChart 
              labels={data.timeSeries.labels}
              datasets={data.timeSeries.datasets}
            />
          )}
        </div>

        {/* Side panel - Recalculate */}
        <div className="space-y-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Admin Actions</h3>
            <Button
              variant="outline"
              onClick={() => recalculate.mutate(undefined)}
              disabled={recalculate.isPending}
              className="w-full text-xs"
            >
              {recalculate.isPending ? 'Recalculando...' : 'Recalcular Métricas'}
            </Button>
            <p className="text-xs text-slate-500 mt-2">
              Fuerza recálculo de métricas para fechas recientes.
            </p>
          </div>

          {/* Info Stickiness */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Stickiness Guide</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-red-400">&lt; 10%</span>
                <span className="text-slate-500">Problem</span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-400">10-15%</span>
                <span className="text-slate-500">Regular</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">15-25%</span>
                <span className="text-slate-500">Healthy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">30%+</span>
                <span className="text-slate-500">Strong</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Table */}
      {data?.daily && <DailyTable data={data.daily} />}

      {/* Footer */}
      <div className="text-xs text-slate-500 pt-4 border-t border-[#1e293b]">
        Last updated: {data?.daily?.[data.daily.length - 1]?.calculated_at 
          ? new Date(data.daily[data.daily.length - 1].calculated_at).toLocaleString()
          : 'Never'}
      </div>
    </div>
  );
}
