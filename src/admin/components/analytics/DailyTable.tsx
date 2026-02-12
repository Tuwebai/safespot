/**
 * ============================================================================
 * DAILY TABLE - Tabla de métricas diarias
 * ============================================================================
 */

import { formatDuration, formatNumber } from '../../hooks/useAnalyticsAdmin';

interface DailyMetric {
  date: string;
  dau: number;
  new_users: number;
  returning_users: number;
  total_sessions: number;
  avg_session_duration_seconds: number | null;
  reports_created: number;
  comments_created: number;
  votes_cast: number;
}

interface DailyTableProps {
  data: DailyMetric[];
}

export function DailyTable({ data }: DailyTableProps) {
  // Ordenar por fecha descendente (más reciente primero)
  const sortedData = [...data].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Formatear fecha (2026-02-11 → 11/02/2026)
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1e293b]">
        <h3 className="text-lg font-semibold text-white">Daily Breakdown</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1e293b]/50">
            <tr>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Date</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">DAU</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">New</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Ret.</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Sess.</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Avg Time</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Reports</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Comments</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Votes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {sortedData.map((row) => (
              <tr key={row.date} className="hover:bg-[#1e293b]/30">
                <td className="px-4 py-3 text-slate-300">
                  {formatDate(row.date)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                  {formatNumber(row.dau)}
                </td>
                <td className="px-4 py-3 text-right text-blue-400">
                  {formatNumber(row.new_users)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {formatNumber(row.returning_users)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {formatNumber(row.total_sessions)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {formatDuration(row.avg_session_duration_seconds || 0)}
                </td>
                <td className="px-4 py-3 text-right text-orange-400">
                  {row.reports_created}
                </td>
                <td className="px-4 py-3 text-right text-purple-400">
                  {row.comments_created}
                </td>
                <td className="px-4 py-3 text-right text-green-400">
                  {row.votes_cast}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {sortedData.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          No data available for selected period
        </div>
      )}
    </div>
  );
}
