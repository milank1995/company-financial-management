'use client';

import React, { useEffect, useState, useRef } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  CalendarDays,
  Percent,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  RefreshCw,
} from 'lucide-react';
import InteractiveDonutChart from '@/components/charts/InteractiveDonutChart';
import InteractiveLineChart from '@/components/charts/InteractiveLineChart';
import DrilldownModal from '@/components/DrilldownModal';

interface MonthlyPartnerBreakdownTableProps {
  breakdown: any[];
  months: { value: number; label: string }[];
  formatCurrency: (val: number) => string;
  onDrilldown: (partnerId: string, partnerName: string, type: any, periods: string[]) => void;
}

function MonthlyPartnerBreakdownTable({ breakdown, months, formatCurrency, onDrilldown }: MonthlyPartnerBreakdownTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  if (!breakdown || breakdown.length === 0) return null;

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-800 w-full overflow-hidden space-y-4">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between pb-2 border-b border-slate-800/60 text-left hover:opacity-90 select-none"
      >
        <div>
          <h3 className="text-lg font-bold text-white flex items-center">
            <span>Month-wise Partner Settlement Breakdown</span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-400 rounded ml-3">
              {breakdown.length} {breakdown.length === 1 ? 'Month' : 'Months'}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isCollapsed ? 'Click to expand month-wise breakdown list' : 'Click to collapse list'}
          </p>
        </div>
        <span className="text-slate-400 hover:text-white transition-colors">
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-3 animate-fade-in">
          {breakdown.map((row: any) => {
            const monthName = months.find((m) => m.value === row.month)?.label || `Month ${row.month}`;
            const monthLabel = row.year ? `${monthName} ${row.year}` : monthName;
            const periodKey = `${row.year}-${row.month}`;
            const isExpanded = !!expandedMonths[periodKey];

            return (
              <div
                key={periodKey}
                className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/20 hover:border-slate-700/60 transition-colors"
              >
                {/* Row Header */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedMonths((prev) => ({
                      ...prev,
                      [periodKey]: !prev[periodKey],
                    }));
                  }}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 text-left hover:bg-slate-800/5 transition-colors gap-3 select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-base font-bold text-white min-w-[100px]">{monthLabel}</span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400">
                        Profit: <strong className="text-slate-200">{formatCurrency(row.netProfit)}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-400">
                        Income: <strong className="text-slate-200">{formatCurrency(row.totalIncome)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Summary of each partner's balance */}
                    <div className="flex items-center space-x-3">
                      {row.partnerSettlements?.map((ps: any) => {
                        const isReceivable = ps.netBalance >= 0;
                        return (
                          <div
                            key={ps.partnerId}
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                              isReceivable
                                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/5 border-rose-500/10 text-rose-400'
                            }`}
                          >
                            <span className="opacity-80">{ps.partnerName}:</span>
                            <span>{isReceivable ? '+' : ''}{formatCurrency(ps.netBalance)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Arrow indicator */}
                    <span className="text-slate-500 hover:text-white transition-colors">
                      {isExpanded ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>

                {/* Row Detailed Expansion */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/60 bg-[#070b14]/40 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {row.partnerSettlements?.map((ps: any) => {
                      const isReceivable = ps.netBalance >= 0;
                      return (
                        <div
                          key={ps.partnerId}
                          className="glass-card p-4 rounded-xl border border-slate-800/80 bg-slate-900/10 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/50 pb-2">
                            <span className="text-sm font-bold text-white flex items-center">
                              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 mr-2" />
                              {ps.partnerName}
                            </span>
                            <span className="text-[11px] font-semibold bg-slate-850 px-2 py-0.5 rounded text-cyan-400">
                              Ownership: {ps.ownershipPercentage?.toFixed(2)}%
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'profit_share', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="Audit Profit Share breakdown"
                            >
                              <span>Profit Share:</span>
                              <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">{formatCurrency(ps.profitShare)}</span>
                            </div>
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'salaries_paid', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="View paid salaries list"
                            >
                              <span>Paid Personally (Salaries):</span>
                              <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">+{formatCurrency(ps.salariesPaid)}</span>
                            </div>
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'expenses_paid', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="View paid expenses list"
                            >
                              <span>Paid Personally (Expenses):</span>
                              <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">+{formatCurrency(ps.expensesPaid)}</span>
                            </div>
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'project_payments', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="View received project payments"
                            >
                              <span>Money Received (Company Payments):</span>
                              <span className="font-semibold text-rose-450 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">-{formatCurrency(ps.companyMoneyReceived)}</span>
                            </div>
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'client_direct', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="View received direct salaries"
                            >
                              <span>Money Received (Client Direct):</span>
                              <span className="font-semibold text-rose-455 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">-{formatCurrency(ps.clientDirectSalaryReceived)}</span>
                            </div>
                            <div 
                              onClick={() => onDrilldown(ps.partnerId, ps.partnerName, 'adjustments', [periodKey])}
                              className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                              title="View adjustments ledger"
                            >
                              <span>Net Adjustments:</span>
                              <span className={`font-semibold group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 ${ps.netAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                {ps.netAdjustment >= 0 ? '+' : ''}{formatCurrency(ps.netAdjustment)}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`flex items-center justify-between border-t border-slate-800/50 pt-2.5 mt-1 text-xs font-bold ${
                              isReceivable ? 'text-emerald-400' : 'text-rose-500'
                            }`}
                          >
                            <span>{isReceivable ? 'Receivable (Owed to Partner)' : 'Payable (Owed by Partner)'}:</span>
                            <span className="text-sm">{isReceivable ? '+' : ''}{formatCurrency(ps.netBalance)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['2026-08']); // default to August 2026
  const [monthsDropdownOpen, setMonthsDropdownOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Drilldown Modal States
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownConfig, setDrilldownConfig] = useState<{
    partnerId?: string;
    partnerName?: string;
    type: 'profit_share' | 'salaries_paid' | 'expenses_paid' | 'client_direct' | 'project_payments' | 'adjustments' | 'credits' | 'debits';
    periods: string[];
  }>({
    type: 'profit_share',
    periods: [],
  });

  const handleDrilldown = (
    partnerId: string,
    partnerName: string,
    type: any,
    periods: string[]
  ) => {
    setDrilldownConfig({
      partnerId,
      partnerName,
      type,
      periods,
    });
    setDrilldownOpen(true);
  };

  const years = [2024, 2025, 2026, 2027, 2028];
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  // Fetch partners list once on mount
  useEffect(() => {
    const loadPartners = async () => {
      try {
        const res = await fetch('/api/partners');
        if (res.ok) {
          const json = await res.json();
          setPartners(json);
        }
      } catch (err) {
        console.error('Error loading partners:', err);
      }
    };
    if (user) {
      loadPartners();
    }
  }, [user]);

  const togglePeriod = (periodStr: string) => {
    setSelectedPeriods((prev) => {
      if (prev.includes(periodStr)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== periodStr);
      } else {
        return [...prev, periodStr].sort();
      }
    });
  };

  const toggleYearAll = (year: number) => {
    const yearPeriods = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    setSelectedPeriods((prev) => {
      const hasAll = yearPeriods.every((p) => prev.includes(p));
      if (hasAll) {
        const remaining = prev.filter((p) => !yearPeriods.includes(p));
        if (remaining.length === 0) {
          return [`${year}-01`].sort();
        }
        return remaining.sort();
      } else {
        const union = Array.from(new Set([...prev, ...yearPeriods]));
        return union.sort();
      }
    });
  };

  const fetchData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    let url =
      viewType === 'monthly'
        ? `/api/dashboard/monthly?periods=${selectedPeriods.join(',')}`
        : `/api/dashboard/yearly?year=${selectedYear}`;

    if (selectedPartnerId) {
      url += `&partnerId=${selectedPartnerId}`;
    }

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, viewType, selectedYear, selectedPeriods, selectedPartnerId]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (authLoading) return null;

  const partnerSettlement = selectedPartnerId && data
    ? data.partnerSettlements?.find((p: any) => p.partnerId === selectedPartnerId)
    : null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };



  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Financial Dashboard</h1>
            <p className="text-slate-400 mt-1">On-demand performance-optimized dynamic accounting analysis</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            {/* View Type Toggle */}
            <div className="bg-[#0f172a] p-1 rounded-lg border border-[#1e293b] flex w-full md:w-auto">
              <button
                onClick={() => setViewType('monthly')}
                className={`flex-1 md:flex-initial px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  viewType === 'monthly'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewType('yearly')}
                className={`flex-1 md:flex-initial px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  viewType === 'yearly'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Year Selector (only for yearly view) */}
            {viewType === 'yearly' && (
              <div className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-3 py-1.5 w-full md:w-auto justify-between md:justify-start">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-400 md:hidden">Year</span>
                </div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white text-sm focus:outline-none border-none pr-6 py-0.5 md:w-auto text-right md:text-left"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-[#0f172a] text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Unified Cross-Year Period Selector (only for monthly view) */}
            {viewType === 'monthly' && (
              <div className="relative w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setMonthsDropdownOpen(!monthsDropdownOpen)}
                  className="flex items-center justify-between md:justify-start space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-3 py-2.5 md:py-2 text-white text-sm hover:bg-[#1e293b] transition-colors w-full md:w-auto"
                >
                  <div className="flex items-center space-x-1.5">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <span className="md:hidden text-slate-400">Periods</span>
                  </div>
                  <span>
                    {selectedPeriods.length === 0
                      ? 'Select Periods'
                      : selectedPeriods.length > 3
                      ? `${selectedPeriods.length} Periods`
                      : selectedPeriods
                          .map((p) => {
                            const [y, m] = p.split('-');
                            const mName = months.find((mo) => mo.value === parseInt(m, 10))?.label.substring(0, 3);
                            return `${mName} ${y}`;
                          })
                          .join(', ')}
                  </span>
                </button>

                {monthsDropdownOpen && (
                  <>
                    {/* mobile backdrop overlay */}
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden animate-fade-in" onClick={() => setMonthsDropdownOpen(false)} />
                    {/* desktop click outside overlay */}
                    <div className="fixed inset-0 z-10 hidden md:block" onClick={() => setMonthsDropdownOpen(false)} />
                    
                    <div className="fixed bottom-4 inset-x-4 max-h-[80vh] md:absolute md:bottom-auto md:inset-x-auto md:right-0 md:mt-2 md:w-80 bg-[#0b0f19] border border-slate-800 rounded-xl shadow-2xl z-30 p-4 space-y-4 md:max-h-[450px] overflow-y-auto animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Periods</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPeriods(['2026-08']);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          Reset
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {years.map((y) => {
                          const yearPeriods = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
                          const hasAll = yearPeriods.every((p) => selectedPeriods.includes(p));
                          const hasSome = yearPeriods.some((p) => selectedPeriods.includes(p)) && !hasAll;
                          
                          return (
                            <div key={y} className="space-y-2 border-b border-slate-800/40 pb-3 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-white">{y}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleYearAll(y)}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                                    hasAll
                                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                      : hasSome
                                      ? 'bg-slate-800 text-slate-300 border-slate-700/60'
                                      : 'text-slate-400 hover:text-white border-transparent'
                                  }`}
                                >
                                  {hasAll ? 'Deselect All' : 'Select All'}
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-4 gap-1.5">
                                {months.map((m) => {
                                  const pStr = `${y}-${String(m.value).padStart(2, '0')}`;
                                  const isChecked = selectedPeriods.includes(pStr);
                                  return (
                                    <button
                                      key={m.value}
                                      type="button"
                                      onClick={() => togglePeriod(pStr)}
                                      className={`px-1.5 py-1 text-[11px] font-medium rounded border text-center transition-all ${
                                        isChecked
                                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold'
                                          : 'bg-[#0f172a]/40 text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30'
                                      }`}
                                    >
                                      {m.label.substring(0, 3)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Partner Selector */}
            <div className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-3 py-1.5 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center space-x-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400 md:hidden">Partner</span>
              </div>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none border-none pr-6 py-0.5 md:w-auto text-right md:text-left"
              >
                <option value="" className="bg-[#0f172a] text-white">
                  All Partners
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f172a] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              className="p-2.5 md:p-2 bg-[#0f172a] text-slate-450 rounded-lg hover:text-white border border-[#1e293b] hover:bg-[#1e293b] transition-colors flex items-center justify-center w-full md:w-10 h-10"
              title="Refresh Dashboard Data"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
        ) : data ? (
          <div className="space-y-8 animate-fade-in">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Income */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    {partnerSettlement ? 'Your Profit Share' : 'Total Income'}
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mt-2">
                    {formatCurrency(partnerSettlement ? partnerSettlement.profitShare : data.totalIncome)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <TrendingUp className="h-6 w-6 text-emerald-400" />
                </div>
              </div>

              {/* Salaries */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      {partnerSettlement ? 'Your Salaries Paid' : 'Salary Expense'}
                    </p>
                    <p className="text-2xl font-bold text-red-400 mt-2">
                      {formatCurrency(partnerSettlement ? partnerSettlement.salariesPaid : data.totalSalaries)}
                    </p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    <TrendingDown className="h-6 w-6 text-red-400" />
                  </div>
                </div>
                {partnerSettlement ? (
                  <div className="mt-4 space-y-1 text-xs border-t border-slate-800/80 pt-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Salary Received (Client Direct):</span>
                      <span className="font-semibold text-slate-200">
                        {formatCurrency(partnerSettlement.clientDirectSalaryReceived)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 italic mt-0.5">
                      Acts as a liability reducing your settlement
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-1 text-xs border-t border-slate-800/80 pt-3">
                    <div className="flex justify-between text-slate-400">
                      <span>Paid by Company:</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(data.paidByCompany)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Paid by Partners:</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(data.paidByPartners)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Paid by Clients:</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(data.paidDirectlyByClients)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    {partnerSettlement ? 'Your Expenses Covered' : 'Company Expenses'}
                  </p>
                  <p className="text-2xl font-bold text-orange-400 mt-2">
                    {formatCurrency(partnerSettlement ? partnerSettlement.expensesPaid : data.totalExpenses)}
                  </p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                  <DollarSign className="h-6 w-6 text-orange-400" />
                </div>
              </div>

              {/* Net Profit / Settlement */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    {partnerSettlement ? 'Your Settlement Balance' : 'Net Profit'}
                  </p>
                  <p className={`text-2xl font-bold mt-2 ${
                    (partnerSettlement ? partnerSettlement.netBalance : data.netProfit) >= 0 ? 'text-cyan-400' : 'text-rose-500'
                  }`}>
                    {formatCurrency(partnerSettlement ? partnerSettlement.netBalance : data.netProfit)}
                  </p>
                </div>
                <div className={`p-3 rounded-xl border ${
                  (partnerSettlement ? partnerSettlement.netBalance : data.netProfit) >= 0
                    ? 'bg-cyan-500/10 border-cyan-500/20'
                    : 'bg-rose-500/10 border-rose-500/20'
                }`}>
                  <Percent className={`h-6 w-6 ${
                    (partnerSettlement ? partnerSettlement.netBalance : data.netProfit) >= 0 ? 'text-cyan-400' : 'text-rose-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* Visual Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {viewType === 'monthly' ? (
                <>
                  {/* Left Column: Operating Margin Ring */}
                  <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between lg:col-span-1">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Operating Margin</h3>
                      <p className="text-xs text-slate-400">Net Profit relative to Total Income</p>
                      
                      <div className="mt-8 flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                          <svg className="w-36 h-36">
                            <circle
                              className="text-slate-800"
                              strokeWidth="8"
                              stroke="currentColor"
                              fill="transparent"
                              r="60"
                              cx="72"
                              cy="72"
                            />
                            <circle
                              className="text-cyan-400 transition-all duration-1000"
                              strokeWidth="8"
                              strokeDasharray={377}
                              strokeDashoffset={
                                data.totalIncome > 0
                                  ? 377 - (377 * Math.max(0, Math.min(data.netProfit, data.totalIncome))) / data.totalIncome
                                  : 377
                              }
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="transparent"
                              r="60"
                              cx="72"
                              cy="72"
                              transform="rotate(-90 72 72)"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <span className="text-2xl font-bold text-white">
                              {data.totalIncome > 0
                                ? Math.max(0, Math.round((data.netProfit / data.totalIncome) * 100))
                                : 0}
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    <div className="mt-6 border-t border-slate-800 pt-4 text-center">
                      <p className="text-xs text-slate-400 font-medium">
                        Operating Margin for {
                          selectedPeriods.length === 0
                            ? 'No periods selected'
                            : selectedPeriods.length > 3
                            ? `${selectedPeriods.length} Periods`
                            : selectedPeriods
                                .map((p) => {
                                  const [y, m] = p.split('-');
                                  const mName = months.find((mo) => mo.value === parseInt(m, 10))?.label.substring(0, 3);
                                  return `${mName} ${y}`;
                                })
                                .join(', ')
                        }
                      </p>
                    </div>
                  </div>
                </div>

                  {/* Right Columns: Interactive Monthly Expenses Donut Chart */}
                  <div className="lg:col-span-2">
                    <InteractiveDonutChart
                      data={data.expensesByCategory || []}
                      title="Monthly Expenses Breakdown"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Left Column: Interactive Yearly Expenses Donut Chart */}
                  <div className="lg:col-span-1">
                    <InteractiveDonutChart
                      data={data.expensesByCategory || []}
                      title="Yearly Expenses Breakdown"
                    />
                  </div>

                  {/* Right Columns: Interactive Yearly Performance Line Chart */}
                  <div className="lg:col-span-2">
                    <InteractiveLineChart
                      data={data.monthlyBreakdown || []}
                      title="Monthly Financial Trend"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Month-wise Partner Breakdown Accordion Table */}
            <MonthlyPartnerBreakdownTable
              breakdown={data.monthlyBreakdown || []}
              months={months}
              formatCurrency={formatCurrency}
              onDrilldown={handleDrilldown}
            />

            {/* Partner Financial Summary Cards */}
            <div className="space-y-4 w-full">
              <div>
                <h3 className="text-lg font-bold text-white">Partner Financial Summary</h3>
                <p className="text-xs text-slate-400 mt-0.5">Comparative summary of partner settlements for the selected period</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {(partnerSettlement ? [partnerSettlement] : data.partnerSettlements || []).map((p: any) => {
                  const isReceivable = p.netBalance >= 0;
                  const drilldownPeriods = viewType === 'yearly'
                    ? Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`)
                    : selectedPeriods;

                  return (
                    <div
                      key={p.partnerId}
                      className="glass-card rounded-2xl border border-slate-800 bg-slate-900/10 flex flex-col justify-between overflow-hidden shadow-lg"
                    >
                      {/* Card Header */}
                      <div className="p-5 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
                        <h4 className="text-base font-bold text-white flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 mr-2" />
                          {p.partnerName}
                        </h4>
                        {p.ownershipPercentage !== undefined && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-cyan-400">
                            Ownership: {p.ownershipPercentage?.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 space-y-5 text-sm">
                        {/* Section 1: Earnings & Adjustments */}
                        <div className="space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-800/50 pb-1">
                            Share & Adjustments
                          </p>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'profit_share', drilldownPeriods)}
                            className="flex justify-between text-slate-350 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="Audit Profit Share breakdown"
                          >
                            <span>Profit Share:</span>
                            <span className="font-semibold text-white group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">{formatCurrency(p.profitShare)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'credits', drilldownPeriods)}
                            className="flex justify-between text-slate-450 text-xs cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View Credits adjustment ledger"
                          >
                            <span className="pl-3">Other Credits:</span>
                            <span className="font-medium text-emerald-450 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">+{formatCurrency(p.credits)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'debits', drilldownPeriods)}
                            className="flex justify-between text-slate-450 text-xs cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View Debits adjustment ledger"
                          >
                            <span className="pl-3">Other Debits:</span>
                            <span className="font-medium text-rose-500 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">-{formatCurrency(p.debits)}</span>
                          </div>
                        </div>

                        {/* Section 2: Out-of-pocket Spend */}
                        <div className="space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-800/50 pb-1">
                            Paid Personally (Reimbursable)
                          </p>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'salaries_paid', drilldownPeriods)}
                            className="flex justify-between text-slate-355 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View paid salaries list"
                          >
                            <span>Salaries Paid:</span>
                            <span className="font-semibold text-white group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">+{formatCurrency(p.salariesPaid)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'expenses_paid', drilldownPeriods)}
                            className="flex justify-between text-slate-355 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View paid expenses list"
                          >
                            <span>Company Expenses:</span>
                            <span className="font-semibold text-white group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">+{formatCurrency(p.expensesPaid)}</span>
                          </div>
                        </div>

                        {/* Section 3: Money Received */}
                        <div className="space-y-2.5 bg-slate-900/25 p-3.5 rounded-xl border border-slate-800/50">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-800/30 pb-1">
                            Received Income (Company Liabilities)
                          </p>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'project_payments', drilldownPeriods)}
                            className="flex justify-between text-slate-355 text-xs cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View received project payments"
                          >
                            <span>Project Payments:</span>
                            <span className="font-medium text-rose-450 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">-{formatCurrency(p.companyMoneyReceived)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'client_direct', drilldownPeriods)}
                            className="flex justify-between text-slate-355 text-xs cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View received direct salaries"
                          >
                            <span>Client Direct Salary:</span>
                            <span className="font-medium text-rose-455 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650">-{formatCurrency(p.clientDirectSalaryReceived)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-800/60 pt-2 text-slate-300 font-semibold mt-1">
                            <span>Total Money Received:</span>
                            <span className="text-amber-450">{formatCurrency(p.totalCompanyMoneyReceived)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Settlement Net Balance */}
                      <div className={`p-4 text-sm font-bold flex items-center justify-between border-t border-slate-800/80 ${
                        isReceivable ? 'bg-emerald-500/5 text-emerald-400' : 'bg-rose-500/5 text-rose-500'
                      }`}>
                        <span className="flex items-center space-x-1">
                          {isReceivable ? (
                            <>
                              <ArrowUpRight className="h-4 w-4 text-emerald-400 mr-1" />
                              <span>Receivable (Company Owed)</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="h-4 w-4 text-rose-500 mr-1" />
                              <span>Payable (Partner Owed)</span>
                            </>
                          )}
                        </span>
                        <span className="text-lg font-extrabold">{formatCurrency(p.netBalance)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section: Settlement Net Balances Card */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 w-full">
              <h3 className="text-lg font-bold text-white">Settlement Net Balances Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Receivables */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center border-b border-slate-800 pb-2">
                    <ArrowUpRight className="h-4 w-4 mr-1.5" /> Owed to Partner (Company Payables)
                  </p>
                  <div className="space-y-2">
                    {((partnerSettlement ? [partnerSettlement] : data.partnerSettlements) || []).filter((p: any) => p.netBalance >= 0).length === 0 ? (
                      <p className="text-xs text-slate-500">No partner receivables.</p>
                    ) : (
                      ((partnerSettlement ? [partnerSettlement] : data.partnerSettlements) || [])
                        .filter((p: any) => p.netBalance >= 0)
                        .map((p: any) => (
                          <div key={p.partnerId} className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs">
                            <span className="font-semibold text-white">{p.partnerName}</span>
                            <span className="font-bold text-emerald-400">{formatCurrency(p.netBalance)}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Payables */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center border-b border-slate-800 pb-2">
                    <ArrowDownLeft className="h-4 w-4 mr-1.5" /> Owed by Partner (Company Receivables)
                  </p>
                  <div className="space-y-2">
                    {((partnerSettlement ? [partnerSettlement] : data.partnerSettlements) || []).filter((p: any) => p.netBalance < 0).length === 0 ? (
                      <p className="text-xs text-slate-500">No partner payables.</p>
                    ) : (
                      ((partnerSettlement ? [partnerSettlement] : data.partnerSettlements) || [])
                        .filter((p: any) => p.netBalance < 0)
                        .map((p: any) => (
                          <div key={p.partnerId} className="flex justify-between items-center p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-xs">
                            <span className="font-semibold text-white">{p.partnerName}</span>
                            <span className="font-bold text-rose-400">{formatCurrency(Math.abs(p.netBalance))}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <DrilldownModal
        isOpen={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        partnerId={drilldownConfig.partnerId}
        partnerName={drilldownConfig.partnerName}
        periods={drilldownConfig.periods}
        type={drilldownConfig.type}
      />
    </SidebarLayout>
  );
}
