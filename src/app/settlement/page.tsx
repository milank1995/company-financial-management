'use client';

import React, { useEffect, useState, useRef } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CalendarDays, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import DrilldownModal from '@/components/DrilldownModal';

interface SettlementItem {
  partnerId: string;
  partnerName: string;
  ownershipPercentage?: number;
  profitShare: number;
  companyMoneyReceived: number;       // Project payments received (PPR_P)
  clientDirectSalaryReceived: number; // Client direct salaries received (CDSR_P)
  totalCompanyMoneyReceived: number; // PPR_P + CDSR_P (TCMR_P)
  salariesPaid: number;              // ESP_P
  expensesPaid: number;              // CEP_P
  credits: number;
  debits: number;
  netAdjustment: number;
  netBalance: number;
  settlementType: 'RECEIVABLE' | 'PAYABLE';
}

export default function SettlementPage() {
  const { user } = useAuth();
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['2026-08']); // default to August 2026
  const [monthsDropdownOpen, setMonthsDropdownOpen] = useState(false);
  const [data, setData] = useState<any>(null);
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
      const hasAll = yearPeriods.every((p) => selectedPeriods.includes(p));
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
    const url =
      viewType === 'monthly'
        ? `/api/dashboard/monthly?periods=${selectedPeriods.join(',')}`
        : `/api/dashboard/yearly?year=${selectedYear}`;

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to fetch settlement data');
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
  }, [user, viewType, selectedYear, selectedPeriods]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Partner Settlement</h1>
            <p className="text-slate-400 mt-1">
              {viewType === 'monthly'
                ? `Calculated net balances for ${
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
                  }`
                : `Aggregated year-to-date settlements for ${selectedYear}`}
            </p>
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

            <button
              onClick={fetchData}
              className="p-2.5 md:p-2 bg-slate-800 text-slate-300 rounded-lg hover:text-white border border-slate-700 hover:bg-slate-750 transition-colors flex items-center justify-center w-full md:w-10 h-10"
              title="Recalculate Ledger"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Explainers */}
        <div className="rounded-xl bg-[#1e293b]/30 border border-[#2e3e56] p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-white">How settlements are calculated:</p>
            <p>
              <span className="text-cyan-400 font-medium">Final Settlement</span> = Profit Share + Salaries Paid Personally + Expenses Paid Personally + Adjustments (Credits - Debits) - Total Company Money Received.
            </p>
            <p>
              * Note: <span className="text-white font-medium">Total Company Money Received</span> is the sum of project payments received + client direct salary payments received directly into the partner&apos;s account. This money is held on behalf of the company and acts as a liability that reduces the partner&apos;s settlement receivable.
            </p>
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
            {/* Main Settlements Table */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Detailed Partner Settlement Ledger</h3>
                <span className="text-xs text-slate-400">Calculated Dynamically from Transactions</span>
              </div>
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 text-left font-semibold">
                      <th className="pb-3 pr-4">Partner</th>
                      {viewType === 'monthly' && <th className="pb-3 px-4 text-right">Ownership %</th>}
                      <th className="pb-3 px-4 text-right">Profit Share</th>
                      <th className="pb-3 px-4 text-right">Salaries Paid Personally</th>
                      <th className="pb-3 px-4 text-right">Expenses Paid Personally</th>
                      <th className="pb-3 px-4 text-right">Adjustments (Net)</th>
                      <th className="pb-3 px-4 text-right text-orange-400/80">Client Direct Salary Received</th>
                      <th className="pb-3 px-4 text-right bg-slate-900/40 rounded-t-lg text-amber-400">Total Money Received</th>
                      <th className="pb-3 pl-6 text-right bg-slate-900/60 rounded-t-lg">Final Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.partnerSettlements?.map((p: SettlementItem) => {
                      const drilldownPeriods = viewType === 'yearly'
                        ? Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`)
                        : selectedPeriods;

                      return (
                        <tr key={p.partnerId} className="text-slate-300 hover:bg-slate-800/10">
                          <td className="py-4 pr-4 font-semibold text-white">{p.partnerName}</td>
                          {viewType === 'monthly' && (
                            <td className="py-4 px-4 text-right font-medium text-cyan-400">
                              {p.ownershipPercentage?.toFixed(2)}%
                            </td>
                          )}
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'profit_share', drilldownPeriods)}
                            className="py-4 px-4 text-right cursor-pointer hover:text-cyan-400 font-semibold underline decoration-dotted decoration-slate-700"
                            title="Audit Profit Share breakdown"
                          >
                            {formatCurrency(p.profitShare)}
                          </td>
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'salaries_paid', drilldownPeriods)}
                            className="py-4 px-4 text-right text-slate-400 cursor-pointer hover:text-cyan-400 underline decoration-dotted decoration-slate-700"
                            title="View paid salaries list"
                          >
                            {formatCurrency(p.salariesPaid)}
                          </td>
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'expenses_paid', drilldownPeriods)}
                            className="py-4 px-4 text-right text-slate-400 cursor-pointer hover:text-cyan-400 underline decoration-dotted decoration-slate-700"
                            title="View paid expenses list"
                          >
                            {formatCurrency(p.expensesPaid)}
                          </td>
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'adjustments', drilldownPeriods)}
                            className={`py-4 px-4 text-right cursor-pointer hover:text-cyan-400 underline decoration-dotted decoration-slate-700 ${p.netAdjustment >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}
                            title="View adjustments ledger"
                          >
                            {p.netAdjustment >= 0 ? '+' : ''}{formatCurrency(p.netAdjustment)}
                          </td>
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'client_direct', drilldownPeriods)}
                            className="py-4 px-4 text-right text-orange-400 cursor-pointer hover:text-cyan-400 underline decoration-dotted decoration-slate-700"
                            title="View received direct salaries"
                          >
                            {formatCurrency(p.clientDirectSalaryReceived)}
                          </td>
                          <td 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'project_payments', drilldownPeriods)}
                            className="py-4 px-4 text-right bg-slate-900/30 text-amber-400 font-semibold border-l border-slate-850 cursor-pointer hover:text-cyan-400 underline decoration-dotted decoration-slate-700"
                            title="View received project payments"
                          >
                            {formatCurrency(p.totalCompanyMoneyReceived)}
                          </td>
                          <td className={`py-4 pl-6 text-right font-bold text-base bg-slate-900/50 border-l border-slate-800 rounded-b-lg ${
                            p.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-500'
                          }`}>
                            <span className="flex items-center justify-end space-x-1">
                              {p.netBalance >= 0 ? (
                                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <ArrowDownLeft className="h-4 w-4 text-rose-500" />
                              )}
                              <span>{formatCurrency(p.netBalance)}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Ledger Layout */}
              <div className="lg:hidden space-y-4">
                {data.partnerSettlements?.map((p: SettlementItem) => {
                  const isReceivable = p.netBalance >= 0;
                  const drilldownPeriods = viewType === 'yearly'
                    ? Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`)
                    : selectedPeriods;

                  return (
                    <div
                      key={p.partnerId}
                      className="border border-slate-800 rounded-xl p-4 bg-slate-950/20 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-white text-base">{p.partnerName}</span>
                        {viewType === 'monthly' && p.ownershipPercentage !== undefined && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                            Ownership: {p.ownershipPercentage?.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'profit_share', drilldownPeriods)}
                          className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="Audit Profit Share breakdown"
                        >
                          <span>Profit Share:</span>
                          <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">{formatCurrency(p.profitShare)}</span>
                        </div>
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'salaries_paid', drilldownPeriods)}
                          className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="View paid salaries list"
                        >
                          <span>Salaries Paid:</span>
                          <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">+{formatCurrency(p.salariesPaid)}</span>
                        </div>
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'expenses_paid', drilldownPeriods)}
                          className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="View paid expenses list"
                        >
                          <span>Expenses Paid:</span>
                          <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">+{formatCurrency(p.expensesPaid)}</span>
                        </div>
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'adjustments', drilldownPeriods)}
                          className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="View adjustments ledger"
                        >
                          <span>Adjustments:</span>
                          <span className={`font-semibold group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 ${p.netAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                            {p.netAdjustment >= 0 ? '+' : ''}{formatCurrency(p.netAdjustment)}
                          </span>
                        </div>
                        
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'client_direct', drilldownPeriods)}
                          className="col-span-2 border-t border-slate-800/60 pt-2 flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="View received direct salaries"
                        >
                          <span>Client Direct Salary:</span>
                          <span className="font-semibold text-orange-400 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">{formatCurrency(p.clientDirectSalaryReceived)}</span>
                        </div>
                        <div 
                          onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'project_payments', drilldownPeriods)}
                          className="col-span-2 flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                          title="View received project payments"
                        >
                          <span>Total Money Received:</span>
                          <span className="font-semibold text-amber-400 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600">{formatCurrency(p.totalCompanyMoneyReceived)}</span>
                        </div>
                      </div>

                      <div className={`border-t border-slate-800/80 pt-2 flex justify-between items-center text-sm font-bold ${
                        isReceivable ? 'text-emerald-400' : 'text-rose-500'
                      }`}>
                        <span className="flex items-center space-x-1">
                          {isReceivable ? (
                            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 text-rose-500" />
                          )}
                          <span>{isReceivable ? 'Receivable' : 'Payable'}</span>
                        </span>
                        <span className="text-base font-extrabold">{formatCurrency(p.netBalance)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payables and Receivables Summary Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receivables (Company owes partner) */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-base font-bold text-emerald-400 flex items-center">
                  <ArrowUpRight className="h-5 w-5 mr-1.5" /> Receivables (Owed to Partner)
                </h4>
                <div className="space-y-3">
                  {data.partnerSettlements?.filter((p: any) => p.netBalance >= 0).length === 0 ? (
                    <p className="text-sm text-slate-500">No partner receivables for this period.</p>
                  ) : (
                    data.partnerSettlements
                      ?.filter((p: any) => p.netBalance >= 0)
                      .map((p: any) => (
                        <div
                          key={p.partnerId}
                          className="flex justify-between items-center p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
                        >
                          <span className="text-sm font-semibold text-white">{p.partnerName}</span>
                          <span className="text-sm font-bold text-emerald-400">{formatCurrency(p.netBalance)}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Payables (Partner owes Company) */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-base font-bold text-rose-400 flex items-center">
                  <ArrowDownLeft className="h-5 w-5 mr-1.5" /> Payables (Owed by Partner)
                </h4>
                <div className="space-y-3">
                  {data.partnerSettlements?.filter((p: any) => p.netBalance < 0).length === 0 ? (
                    <p className="text-sm text-slate-500">No partner payables for this period.</p>
                  ) : (
                    data.partnerSettlements
                      ?.filter((p: any) => p.netBalance < 0)
                      .map((p: any) => (
                        <div
                          key={p.partnerId}
                          className="flex justify-between items-center p-3 rounded-xl bg-rose-500/5 border border-rose-500/10"
                        >
                          <span className="text-sm font-semibold text-white">{p.partnerName}</span>
                          <span className="text-sm font-bold text-rose-400">
                            {formatCurrency(Math.abs(p.netBalance))}
                          </span>
                        </div>
                      ))
                  )}
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
