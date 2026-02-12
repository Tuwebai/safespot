/**
 * ============================================================================
 * ANALYTICS CHART - Gráfico de línea simple (sin librerías externas)
 * ============================================================================
 */

import { useMemo } from 'react';

interface AnalyticsChartProps {
  labels: string[];
  datasets: {
    dau: number[];
    new_users: number[];
  };
}

export function AnalyticsChart({ labels, datasets }: AnalyticsChartProps) {
  const { dau, new_users } = datasets;
  
  // Calcular máximo para escalar
  const maxValue = useMemo(() => {
    return Math.max(...dau, ...new_users, 1);
  }, [dau, new_users]);

  // Formatear fecha para mostrar (2026-02-11 → 11/02)
  const formatDate = (dateStr: string) => {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  // Generar puntos para línea SVG
  const generatePoints = (data: number[], height: number, width: number) => {
    if (data.length === 0) return '';
    
    const stepX = width / (data.length - 1 || 1);
    
    return data.map((value, index) => {
      const x = index * stepX;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    }).join(' ');
  };

  const chartHeight = 200;
  const chartWidth = 800;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const dauPoints = generatePoints(dau, chartHeight - padding.top - padding.bottom, chartWidth - padding.left - padding.right);
  const newUsersPoints = generatePoints(new_users, chartHeight - padding.top - padding.bottom, chartWidth - padding.left - padding.right);

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">DAU + New Users</h3>
      
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[600px]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines horizontales */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <line
              key={pct}
              x1={padding.left}
              y1={padding.top + (chartHeight - padding.top - padding.bottom) * (1 - pct)}
              x2={chartWidth - padding.right}
              y2={padding.top + (chartHeight - padding.top - padding.bottom) * (1 - pct)}
              stroke="#1e293b"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Eje Y - Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <text
              key={pct}
              x={padding.left - 10}
              y={padding.top + (chartHeight - padding.top - padding.bottom) * (1 - pct) + 4}
              fill="#64748b"
              fontSize="10"
              textAnchor="end"
            >
              {Math.round(maxValue * pct)}
            </text>
          ))}

          {/* Eje X - Labels (cada 5 días) */}
          {labels.filter((_, i) => i % 5 === 0 || i === labels.length - 1).map((label, i) => {
            const index = i * 5;
            const x = padding.left + (index / (labels.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
            return (
              <text
                key={label}
                x={x}
                y={chartHeight - 10}
                fill="#64748b"
                fontSize="10"
                textAnchor="middle"
              >
                {formatDate(label)}
              </text>
            );
          })}

          {/* Línea DAU */}
          <polyline
            points={dauPoints.split(' ').map((point) => {
              const [x, y] = point.split(',');
              return `${parseFloat(x) + padding.left},${parseFloat(y) + padding.top}`;
            }).join(' ')}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />

          {/* Línea New Users */}
          <polyline
            points={newUsersPoints.split(' ').map((point) => {
              const [x, y] = point.split(',');
              return `${parseFloat(x) + padding.left},${parseFloat(y) + padding.top}`;
            }).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {/* Puntos DAU */}
          {dau.map((value, index) => {
            const x = padding.left + (index / (dau.length - 1 || 1)) * (chartWidth - padding.left - padding.right);
            const y = padding.top + (chartHeight - padding.top - padding.bottom) - (value / maxValue) * (chartHeight - padding.top - padding.bottom);
            return (
              <circle
                key={`dau-${index}`}
                cx={x}
                cy={y}
                r="3"
                fill="#10b981"
              />
            );
          })}
        </svg>
      </div>

      {/* Leyenda */}
      <div className="flex gap-6 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-sm text-slate-400">DAU</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-sm text-slate-400">New Users</span>
        </div>
      </div>
    </div>
  );
}
