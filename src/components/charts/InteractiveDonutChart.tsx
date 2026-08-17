'use client';

import React, { useState } from 'react';

interface DonutData {
  category: string;
  amount: number;
}

interface InteractiveDonutChartProps {
  data: DonutData[];
  title?: string;
}

export default function InteractiveDonutChart({ data, title = 'Expenses Breakdown' }: InteractiveDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((acc, curr) => acc + curr.amount, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
        <p className="text-sm text-slate-500">No expenses logged for this period.</p>
      </div>
    );
  }

  // Predefined gorgeous colors matching our theme (no purple/violet)
  const colors = [
    'hsl(187, 85%, 50%)', // Cyan
    'hsl(150, 75%, 45%)', // Emerald
    'hsl(35, 90%, 50%)',  // Amber
    'hsl(12, 85%, 55%)',  // Terracotta / Orange-Red
    'hsl(200, 80%, 50%)', // Sky Blue
    'hsl(165, 70%, 40%)', // Teal
    'hsl(215, 60%, 55%)', // Indigo/Slate
    'hsl(50, 85%, 45%)',  // Golden Yellow
    'hsl(340, 70%, 50%)', // Muted Rose
  ];

  // Calculate angles
  let accumulatedAngle = -Math.PI / 2; // Start from top (-90 degrees)

  const segments = data.map((item, idx) => {
    const percentage = item.amount / total;
    const angleDelta = percentage * 2 * Math.PI;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angleDelta;
    accumulatedAngle = endAngle;

    return {
      ...item,
      percentage,
      startAngle,
      endAngle,
      color: colors[idx % colors.length],
    };
  });

  // Math helper to draw sector paths
  const getSectorPath = (
    cx: number,
    cy: number,
    rOut: number,
    rIn: number,
    startAngle: number,
    endAngle: number
  ) => {
    // If it's a full 100% circle, draw it slightly differently to prevent path close failures
    if (endAngle - startAngle >= 2 * Math.PI - 0.001) {
      endAngle = startAngle + 2 * Math.PI - 0.001;
    }

    const x1 = cx + rOut * Math.cos(startAngle);
    const y1 = cy + rOut * Math.sin(startAngle);
    const x2 = cx + rOut * Math.cos(endAngle);
    const y2 = cy + rOut * Math.sin(endAngle);

    const xIn1 = cx + rIn * Math.cos(startAngle);
    const yIn1 = cy + rIn * Math.sin(startAngle);
    const xIn2 = cx + rIn * Math.cos(endAngle);
    const yIn2 = cy + rIn * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return `
      M ${x1} ${y1}
      A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${xIn2} ${yIn2}
      A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${xIn1} ${yIn1}
      Z
    `.trim();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const activeSegment = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-xs text-slate-400 mb-6">Interactive categorization summary</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* SVG Donut */}
        <div className="relative flex justify-center items-center">
          <svg
            viewBox="0 0 220 220"
            className="w-48 h-48 md:w-56 md:h-56 transform transition-all duration-300"
          >
            <g transform="translate(10, 10)">
              {segments.map((seg, idx) => {
                const isHovered = hoveredIndex === idx;
                const rOut = isHovered ? 100 : 94;
                const rIn = 65;
                const pathD = getSectorPath(100, 100, rOut, rIn, seg.startAngle, seg.endAngle);

                return (
                  <path
                    key={seg.category}
                    d={pathD}
                    fill={seg.color}
                    className="transition-all duration-300 cursor-pointer stroke-[#0d121f] stroke-1 hover:brightness-110"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Central Label Card */}
          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none w-28 h-28 rounded-full bg-slate-950/40 backdrop-blur-sm border border-slate-800/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 transition-all duration-200">
              {activeSegment ? activeSegment.category : 'Total'}
            </span>
            <span className="text-lg font-bold text-white mt-1 transition-all duration-200">
              {formatCurrency(activeSegment ? activeSegment.amount : total)}
            </span>
            <span className="text-[11px] font-semibold text-cyan-400 mt-0.5">
              {activeSegment
                ? `${(activeSegment.percentage * 100).toFixed(1)}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
          {segments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <div
                key={seg.category}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'bg-slate-800/40 border-slate-700/60 scale-[1.02]'
                    : 'bg-transparent border-transparent hover:bg-slate-900/20'
                }`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className={`text-xs font-medium truncate ${isHovered ? 'text-white font-bold' : 'text-slate-300'}`}>
                    {seg.category}
                  </span>
                </div>
                <div className="text-right pl-4">
                  <p className={`text-xs font-bold ${isHovered ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {formatCurrency(seg.amount)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {(seg.percentage * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
