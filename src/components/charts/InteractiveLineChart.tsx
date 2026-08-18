'use client';

import React, { useState, useRef, useEffect } from 'react';

interface MonthlyBreakdown {
  month: number;
  totalIncome: number;
  totalSalaries: number;
  totalExpenses: number;
  netProfit: number;
}

interface InteractiveLineChartProps {
  data: MonthlyBreakdown[];
  title?: string;
}

export default function InteractiveLineChart({ data, title = 'Financial Performance Trend' }: InteractiveLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center h-64 bg-slate-900/10">
        <p className="text-sm text-slate-500">No trend data available.</p>
      </div>
    );
  }

  // SVG dimensions
  const width = 600;
  const height = 300;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find min and max for Y scale
  const allValues = data.flatMap(d => [d.totalIncome, d.totalSalaries, d.totalExpenses, d.netProfit]);
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 1000) : 1000;
  const minValue = allValues.length > 0 ? Math.min(...allValues, 0) : 0;

  // Add 10% padding to top/bottom of scale
  const range = maxValue - minValue;
  const yMax = maxValue + range * 0.08;
  const yMin = minValue - (range > 0 ? range * 0.08 : 100);

  const numPoints = data.length;

  // Coordinate getters
  const getX = (index: number) => {
    if (numPoints <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (numPoints - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    const scale = (yMax - value) / (yMax - yMin);
    return paddingTop + scale * chartHeight;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getMonthLabel = (d: MonthlyBreakdown) => {
    if (!d) return '';
    const idx = d.month - 1;
    return monthLabels[idx] || `M${d.month}`;
  };

  // Generate SVG path for a specific series key
  const getPathD = (key: keyof Omit<MonthlyBreakdown, 'month'>) => {
    return data.map((d, i) => {
      const x = getX(i);
      const y = getY(d[key] as number);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  // Series metadata (no purple/violet)
  const series = [
    { key: 'totalIncome' as const, label: 'Income', color: 'hsl(187, 85%, 50%)', strokeWidth: 2.5 },
    { key: 'totalSalaries' as const, label: 'Salaries', color: 'hsl(12, 85%, 55%)', strokeWidth: 1.5 },
    { key: 'totalExpenses' as const, label: 'Expenses', color: 'hsl(35, 90%, 50%)', strokeWidth: 1.5 },
    { key: 'netProfit' as const, label: 'Net Profit', color: 'hsl(150, 75%, 45%)', strokeWidth: 2 },
  ];

  // Mouse move handler to detect closest month index
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale factor from SVG coordinates (600 width) to client pixel width
    const svgToClientScale = rect.width / width;
    const localMouseX = mouseX / svgToClientScale;

    // Resolve closest month index based on dataset points count
    const relativeX = localMouseX - paddingLeft;
    let index = 0;
    if (numPoints > 1) {
      index = Math.round((relativeX / chartWidth) * (numPoints - 1));
      index = Math.max(0, Math.min(numPoints - 1, index));
    }

    if (data[index]) {
      setHoveredIdx(index);

      // Calculate tooltip coordinates
      const tooltipX = getX(index);
      const tooltipY = getY(data[index].netProfit);

      setTooltipPos({
        x: tooltipX,
        y: tooltipY,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  // Y-axis ticks (4 intervals)
  const yTicks = Array.from({ length: 5 }).map((_, i) => {
    const val = yMax - (i / 4) * (yMax - yMin);
    return {
      value: val,
      y: getY(val),
      label: formatCurrency(val),
    };
  });

  return (
    <div ref={containerRef} className="glass-card p-6 rounded-2xl border border-slate-800 relative w-full h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
          <p className="text-xs text-slate-400">12-month performance and margin overview</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {series.map(s => (
            <div key={s.key} className="flex items-center space-x-2">
              <span className="w-3 h-0.5" style={{ backgroundColor: s.color, height: `${s.strokeWidth}px` }} />
              <span className="text-xs font-semibold text-slate-300">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                className="stroke-slate-800/80 stroke-1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                className="fill-slate-500 font-semibold text-[10px] text-right"
                textAnchor="end"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* X Axis ticks */}
          {data.map((d, i) => (
            <g key={i}>
              <line
                x1={getX(i)}
                y1={height - paddingBottom}
                x2={getX(i)}
                y2={height - paddingBottom + 5}
                className="stroke-slate-800 stroke-1"
              />
              <text
                x={getX(i)}
                y={height - paddingBottom + 18}
                className={`text-[10px] font-semibold text-center transition-all ${
                  hoveredIdx === i ? 'fill-cyan-400 font-bold' : 'fill-slate-500'
                }`}
                textAnchor="middle"
              >
                {getMonthLabel(d)}
              </text>
            </g>
          ))}

          {/* Zero boundary line */}
          {yMin < 0 && yMax > 0 && (
            <line
              x1={paddingLeft}
              y1={getY(0)}
              x2={width - paddingRight}
              y2={getY(0)}
              className="stroke-slate-700 stroke-1"
            />
          )}

          {/* Data Lines */}
          {series.map(s => (
            <path
              key={s.key}
              d={getPathD(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          ))}

          {/* Hover effects */}
          {hoveredIdx !== null && (
            <g>
              {/* Vertical line indicator */}
              <line
                x1={getX(hoveredIdx)}
                y1={paddingTop}
                x2={getX(hoveredIdx)}
                y2={height - paddingBottom}
                className="stroke-slate-600/80 stroke-1"
                strokeDasharray="3 3"
              />
              {/* Bullet highlights */}
              {series.map(s => {
                const val = data[hoveredIdx][s.key] as number;
                return (
                  <circle
                    key={s.key}
                    cx={getX(hoveredIdx)}
                    cy={getY(val)}
                    r="5"
                    fill={s.color}
                    className="stroke-[#0d121f] stroke-2 animate-pulse"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating Custom Tooltip */}
        {hoveredIdx !== null && tooltipPos && (
          <div
            className="absolute z-10 p-3.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl text-xs space-y-1.5 pointer-events-none transition-all duration-75"
            style={{
              left: `${(tooltipPos.x / width) * 100 > 55 ? `calc(${(tooltipPos.x / width) * 100}% - 170px)` : `calc(${(tooltipPos.x / width) * 100}% + 15px)`}`,
              top: `${Math.max(10, Math.min(height - 150, (tooltipPos.y / height) * 100 - 40))}%`,
              width: '155px',
            }}
          >
            <p className="font-bold text-white text-sm border-b border-slate-800 pb-1 mb-1">
              {getMonthLabel(data[hoveredIdx])} Breakdown
            </p>
            {series.map(s => {
              const val = data[hoveredIdx][s.key] as number;
              const isProfit = s.key === 'netProfit';
              return (
                <div key={s.key} className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">{s.label}:</span>
                  <span
                    className={`font-bold ${
                      isProfit
                        ? val >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-500'
                        : 'text-slate-200'
                    }`}
                  >
                    {formatCurrency(val)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
