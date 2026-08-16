'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, FileSpreadsheet } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
}

interface FilterBarProps {
  partners: Partner[];
  filters: {
    periodType: 'all' | 'monthly' | 'yearly' | 'custom';
    year: number;
    month: number;
    startDate: string;
    endDate: string;
    partnerId: string;
    search: string;
    [key: string]: any;
  };
  onFilterChange: (updated: any) => void;
  onClear: () => void;
  onExportCSV?: () => void;
  totalCount?: number;
  children?: React.ReactNode; // Page-specific selectors (Employee, Project, Source, Category)
}

export default function FinancialFilterBar({
  partners,
  filters,
  onFilterChange,
  onClear,
  onExportCSV,
  totalCount = 0,
  children,
}: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const years = [2024, 2025, 2026, 2027, 2028];
  const months = [
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' },
    { value: 5, label: 'May' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dec' },
  ];

  const updateFilter = (key: string, value: any) => {
    onFilterChange({ ...filters, [key]: value, page: 1 }); // Reset to page 1 on filter changes
  };

  const handlePeriodType = (type: 'all' | 'monthly' | 'yearly' | 'custom') => {
    onFilterChange({
      ...filters,
      periodType: type,
      page: 1,
    });
  };

  const filtersUI = (
    <div className="space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end gap-4 w-full">
      {/* Quick Period filters */}
      <div className="flex flex-col space-y-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Period Type</label>
        <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex w-fit">
          {(['all', 'monthly', 'yearly', 'custom'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handlePeriodType(type)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all uppercase duration-150 ${
                filters.periodType === type
                  ? 'bg-cyan-500 text-black font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type === 'all' ? 'All' : type === 'monthly' ? 'Monthly' : type === 'yearly' ? 'Yearly' : 'Range'}
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Dates */}
      {filters.periodType === 'monthly' && (
        <>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Year</label>
            <select
              value={filters.year}
              onChange={(e) => updateFilter('year', parseInt(e.target.value, 10))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Month</label>
            <select
              value={filters.month}
              onChange={(e) => updateFilter('month', parseInt(e.target.value, 10))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {filters.periodType === 'yearly' && (
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase">Year</label>
          <select
            value={filters.year}
            onChange={(e) => updateFilter('year', parseInt(e.target.value, 10))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {filters.periodType === 'custom' && (
        <>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </>
      )}

      {/* Partner Filter */}
      <div className="flex flex-col space-y-1">
        <label className="text-xs font-semibold text-slate-400 uppercase">Partner</label>
        <select
          value={filters.partnerId}
          onChange={(e) => updateFilter('partnerId', e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[160px]"
        >
          <option value="">All Partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Page Specific Selectors */}
      {children}

      {/* Search Input */}
      <div className="flex flex-col space-y-1 flex-grow max-w-xs">
        <label className="text-xs font-semibold text-slate-400 uppercase">Search</label>
        <div className="relative rounded-lg shadow-sm">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-800 bg-slate-900 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            placeholder="Search keywords..."
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Reset & Export Buttons */}
      <div className="flex items-center space-x-2 pt-2 md:pt-0">
        <button
          type="button"
          onClick={onClear}
          className="flex items-center justify-center p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold"
          title="Clear Filters"
        >
          <X className="h-4 w-4 mr-1" /> Clear
        </button>

        {onExportCSV && (
          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center justify-center p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-all text-xs font-bold"
            title="Export CSV"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden lg:flex lg:items-center lg:justify-between p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 mb-6">
        {filtersUI}
        {totalCount > 0 && (
          <div className="ml-4 text-right flex-shrink-0 text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Results: <span className="text-white font-bold">{totalCount}</span>
          </div>
        )}
      </div>

      {/* Mobile / Tablet Filter bar */}
      <div className="lg:hidden flex items-center justify-between mb-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-sm font-semibold hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2 text-cyan-400" />
          Filters
        </button>
        {onExportCSV && (
          <button
            onClick={onExportCSV}
            className="flex items-center px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-sm font-bold hover:bg-emerald-400"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            CSV
          </button>
        )}
        <div className="text-xs text-slate-400">
          Total: <span className="font-bold text-white">{totalCount}</span>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-[#0d121f] border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <SlidersHorizontal className="h-5 w-5 mr-2 text-cyan-400" />
                  Filter Settings
                </h3>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
                {filtersUI}
              </div>
            </div>

            <div className="flex space-x-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClear}
                className="flex-1 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex-1 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
