'use client';

import React, { useEffect, useState, useRef } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CalendarDays, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft, Info } from 'lucide-react';
import DrilldownModal from '@/components/DrilldownModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import CalculationBreakdownModal from '@/components/CalculationBreakdownModal';

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

  // Settlement Statuses & Exclude Filter State
  const [settlementStatuses, setSettlementStatuses] = useState<any[]>([]);
  const [excludeSettled, setExcludeSettled] = useState(true);

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

  // Multi-select & Batch Progress States
  const [checkedPeriods, setCheckedPeriods] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    current: number;
    total: number;
    mode: 'settling' | 'reopening' | null;
  }>({ active: false, current: 0, total: 0, mode: null });

  // Calculation Breakdown Modal States
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownModalPartner, setBreakdownModalPartner] = useState<string>('');
  const [breakdownModalData, setBreakdownModalData] = useState<any | null>(null);

  const openBreakdownModal = (partnerName: string, item: any) => {
    setBreakdownModalPartner(partnerName);
    setBreakdownModalData({
      profitShare: item.profitShare,
      credits: item.credits || 0,
      debits: item.debits || 0,
      salariesPaid: item.salariesPaid || 0,
      expensesPaid: item.expensesPaid || 0,
      totalCompanyMoneyReceived: item.totalCompanyMoneyReceived || 0,
      netBalance: item.netBalance,
    });
    setBreakdownModalOpen(true);
  };

  // Confirmation Modal States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void | Promise<void>;
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (config: typeof confirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };

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

  const fetchSettlementStatuses = async () => {
    try {
      const res = await fetch('/api/settlement/status');
      if (res.ok) {
        const json = await res.json();
        setSettlementStatuses(json);
      }
    } catch (err) {
      console.error('Failed to fetch settlement statuses:', err);
    }
  };

  const isPeriodSettled = (year: number, month: number) => {
    return settlementStatuses.some((s) => s.year === year && s.month === month && s.isSettled);
  };

  const performToggleSettlement = async (year: number, month: number, targetSettled: boolean) => {
    try {
      const res = await fetch('/api/settlement/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          isSettled: targetSettled,
          notes: targetSettled ? 'Marked settled via ledger view' : null
        })
      });

      if (!res.ok) throw new Error('Failed to update period settlement status');

      await Promise.all([fetchSettlementStatuses(), fetchData()]);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const handleToggleSettlement = (year: number, month: number, targetSettled: boolean) => {
    const actionText = targetSettled ? 'settle' : 'reopen';
    const mName = months.find((m) => m.value === month)?.label;
    
    triggerConfirm({
      title: targetSettled ? 'Settle Period' : 'Reopen Period',
      message: `Are you sure you want to ${actionText} the settlement period for ${mName} ${year}?`,
      confirmText: targetSettled ? 'Settle' : 'Reopen',
      type: targetSettled ? 'success' : 'warning',
      onConfirm: () => performToggleSettlement(year, month, targetSettled),
    });
  };

  const handleBulkToggleSettlement = (targetSettled: boolean) => {
    const actionText = targetSettled ? 'settle' : 'reopen';
    const periodsToUpdate = checkedPeriods.filter(periodKey => {
      const [y, m] = periodKey.split('-');
      const settled = isPeriodSettled(parseInt(y, 10), parseInt(m, 10));
      return settled !== targetSettled;
    });

    if (periodsToUpdate.length === 0) {
      triggerConfirm({
        title: 'No Periods to Update',
        message: `All selected periods are already ${targetSettled ? 'settled' : 'active/open'}.`,
        confirmText: 'Okay',
        cancelText: 'Close',
        type: 'info',
        onConfirm: () => {},
      });
      return;
    }

    triggerConfirm({
      title: targetSettled ? 'Bulk Settle Periods' : 'Bulk Reopen Periods',
      message: `Are you sure you want to ${actionText} all ${periodsToUpdate.length} checked periods at once?`,
      confirmText: targetSettled ? 'Settle Selected' : 'Reopen Selected',
      type: targetSettled ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          setBulkProgress({
            active: true,
            current: 0,
            total: periodsToUpdate.length,
            mode: targetSettled ? 'settling' : 'reopening',
          });

          for (let i = 0; i < periodsToUpdate.length; i++) {
            const periodKey = periodsToUpdate[i];
            const [y, m] = periodKey.split('-');
            const year = parseInt(y, 10);
            const month = parseInt(m, 10);

            const res = await fetch('/api/settlement/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                year,
                month,
                isSettled: targetSettled,
                notes: targetSettled ? 'Marked settled via bulk action' : null
              })
            });

            if (!res.ok) {
              throw new Error(`Failed to update ${periodKey}`);
            }

            setBulkProgress(prev => ({
              ...prev,
              current: i + 1,
            }));
          }

          setCheckedPeriods([]);
          await Promise.all([fetchSettlementStatuses(), fetchData()]);
        } catch (err: any) {
          setError(err.message || 'Bulk update failed');
        } finally {
          setTimeout(() => {
            setBulkProgress({ active: false, current: 0, total: 0, mode: null });
          }, 600);
        }
      }
    });
  };

  const getDisplaySettlements = () => {
    if (!data) return [];
    if (!excludeSettled) return data.partnerSettlements || [];

    if (viewType === 'monthly' && selectedPeriods.length === 1) {
      if (data.isSettled) {
        return (data.partnerSettlements || []).map((ps: any) => ({
          ...ps,
          profitShare: 0,
          companyMoneyReceived: 0,
          clientDirectSalaryReceived: 0,
          totalCompanyMoneyReceived: 0,
          salariesPaid: 0,
          expensesPaid: 0,
          credits: 0,
          debits: 0,
          netAdjustment: 0,
          netBalance: 0,
          settlementType: 'RECEIVABLE',
        }));
      }
      return data.partnerSettlements || [];
    }

    const breakdown = data.monthlyBreakdown || [];
    const activeBreakdown = breakdown.filter((b: any) => !b.isSettled);
    const baseSettlements = data.partnerSettlements || [];
    
    if (activeBreakdown.length === 0) {
      return baseSettlements.map((ps: any) => ({
        ...ps,
        profitShare: 0,
        companyMoneyReceived: 0,
        clientDirectSalaryReceived: 0,
        totalCompanyMoneyReceived: 0,
        salariesPaid: 0,
        expensesPaid: 0,
        credits: 0,
        debits: 0,
        netAdjustment: 0,
        netBalance: 0,
        settlementType: 'RECEIVABLE',
      }));
    }

    const aggregated: Record<string, any> = {};
    baseSettlements.forEach((ps: any) => {
      aggregated[ps.partnerId] = {
        partnerId: ps.partnerId,
        partnerName: ps.partnerName,
        ownershipPercentage: ps.ownershipPercentage,
        profitShare: 0,
        companyMoneyReceived: 0,
        clientDirectSalaryReceived: 0,
        totalCompanyMoneyReceived: 0,
        salariesPaid: 0,
        expensesPaid: 0,
        credits: 0,
        debits: 0,
        netAdjustment: 0,
        netBalance: 0,
      };
    });

    activeBreakdown.forEach((monthData: any) => {
      (monthData.partnerSettlements || []).forEach((ps: any) => {
        const entry = aggregated[ps.partnerId];
        if (entry) {
          entry.profitShare += ps.profitShare;
          entry.companyMoneyReceived += ps.companyMoneyReceived;
          entry.clientDirectSalaryReceived += ps.clientDirectSalaryReceived;
          entry.totalCompanyMoneyReceived += ps.totalCompanyMoneyReceived;
          entry.salariesPaid += ps.salariesPaid;
          entry.expensesPaid += ps.expensesPaid;
          entry.credits += ps.credits;
          entry.debits += ps.debits;
          entry.netAdjustment += ps.netAdjustment;
          entry.netBalance += ps.netBalance;
        }
      });
    });

    return Object.values(aggregated).map((entry: any) => ({
      ...entry,
      settlementType: entry.netBalance >= 0 ? 'RECEIVABLE' : 'PAYABLE',
    }));
  };

  const hasSettledPeriods = () => {
    if (!data) return false;
    if (viewType === 'monthly' && selectedPeriods.length === 1) {
      return !!data.isSettled;
    }
    return (data.monthlyBreakdown || []).some((b: any) => b.isSettled);
  };

  const getPartnerFinancialBreakdown = (partnerId: string) => {
    if (!data) return { total: 0, settled: 0, unsettled: 0 };
    
    let total = 0;
    let settled = 0;
    let unsettled = 0;

    if (viewType === 'monthly' && selectedPeriods.length === 1) {
      const ps = (data.partnerSettlements || []).find((p: any) => p.partnerId === partnerId);
      if (ps) {
        total = ps.netBalance;
        if (data.isSettled) {
          settled = ps.netBalance;
        } else {
          unsettled = ps.netBalance;
        }
      }
    } else {
      const breakdown = data.monthlyBreakdown || [];
      breakdown.forEach((monthData: any) => {
        const ps = (monthData.partnerSettlements || []).find((p: any) => p.partnerId === partnerId);
        if (ps) {
          total += ps.netBalance;
          if (monthData.isSettled) {
            settled += ps.netBalance;
          } else {
            unsettled += ps.netBalance;
          }
        }
      });
    }

    return { total, settled, unsettled };
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
    if (user) {
      fetchSettlementStatuses();
    }
  }, [user]);

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

  const displaySettlements = getDisplaySettlements();

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
                                  const settled = isPeriodSettled(y, m.value);
                                  return (
                                    <button
                                      key={m.value}
                                      type="button"
                                      onClick={() => togglePeriod(pStr)}
                                      className={`px-1.5 py-1 text-[11px] font-medium rounded border text-center transition-all flex items-center justify-center ${
                                        isChecked
                                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-bold'
                                          : 'bg-[#0f172a]/40 text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30'
                                      }`}
                                    >
                                      <span>{m.label.substring(0, 3)}</span>
                                      {settled && <span className="text-emerald-500 text-[10px] ml-0.5" title="Settled">✓</span>}
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
            {/* Settlement Status Management Panel (only for monthly view) */}
            {viewType === 'monthly' && selectedPeriods.length > 0 && (() => {
              const allChecked = selectedPeriods.length > 0 && selectedPeriods.every(p => checkedPeriods.includes(p));
              const someChecked = selectedPeriods.some(p => checkedPeriods.includes(p)) && !allChecked;
              const checkedCount = checkedPeriods.length;

              const handleMasterCheckboxChange = () => {
                if (allChecked) {
                  setCheckedPeriods([]);
                } else {
                  setCheckedPeriods(selectedPeriods);
                }
              };

              return (
                <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-3 gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-1 gap-3">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate = someChecked;
                              }
                            }}
                            onChange={handleMasterCheckboxChange}
                            className="rounded border-slate-850 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4.5 w-4.5"
                          />
                        </label>
                        <div>
                          <h3 className="text-base font-bold text-white">Period Settlement Status</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Manage closing status for selected billing months</p>
                        </div>
                      </div>
                      
                      {checkedCount > 0 && (
                        <div className="flex items-center space-x-2 animate-fade-in">
                          <button
                            type="button"
                            onClick={() => handleBulkToggleSettlement(true)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors border border-emerald-500/20 shadow-md animate-fade-in"
                          >
                            Settle Selected ({checkedCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkToggleSettlement(false)}
                            className="px-2.5 py-1.5 bg-rose-955/40 hover:bg-rose-900/50 text-rose-300 text-[11px] font-bold rounded-lg transition-colors border border-rose-500/20 shadow-md animate-fade-in"
                          >
                            Reopen Selected ({checkedCount})
                          </button>
                        </div>
                      )}
                    </div>
                    <label className="flex items-center space-x-2 text-xs text-slate-300 select-none cursor-pointer hover:text-white transition-colors bg-[#0b0f19] border border-slate-800 px-3 py-1.5 rounded-lg">
                      <input
                        type="checkbox"
                        checked={excludeSettled}
                        onChange={(e) => setExcludeSettled(e.target.checked)}
                        className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                      />
                      <span>Exclude settled periods from running totals</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {selectedPeriods.map((periodKey) => {
                      const [y, m] = periodKey.split('-');
                      const mVal = parseInt(m, 10);
                      const mName = months.find((mo) => mo.value === mVal)?.label;
                      const settled = isPeriodSettled(parseInt(y, 10), mVal);
                      const isChecked = checkedPeriods.includes(periodKey);

                      const toggleChecked = () => {
                        if (isChecked) {
                          setCheckedPeriods(checkedPeriods.filter(p => p !== periodKey));
                        } else {
                          setCheckedPeriods([...checkedPeriods, periodKey]);
                        }
                      };

                      return (
                        <div
                          key={periodKey}
                          onClick={toggleChecked}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-[#155e75]/15 border-cyan-500/40 ring-1 ring-cyan-500/35 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-white'
                              : settled
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-350 hover:border-slate-700/50'
                                : 'bg-slate-900/40 border-slate-800/60 text-white hover:border-slate-750'
                          }`}
                        >
                          <div className="flex items-center space-x-3.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleChecked();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                            />
                            <div className="space-y-1">
                              <span className="text-xs font-bold">{mName} {y}</span>
                              <div className="flex items-center space-x-1.5">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${settled ? 'bg-emerald-450' : 'bg-amber-400'}`} />
                                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                                  {settled ? 'Settled' : 'Active'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSettlement(parseInt(y, 10), mVal, !settled);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                              settled
                                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                                : 'bg-cyan-500 text-black border-transparent hover:bg-cyan-400'
                            }`}
                          >
                            {settled ? 'Reopen' : 'Settle'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Main Settlements Table */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Detailed Partner Settlement Ledger</h3>
                <span className="text-xs text-slate-400">Calculated Dynamically from Transactions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {displaySettlements?.map((p: SettlementItem) => {
                  const isReceivable = p.netBalance >= 0;
                  const drilldownPeriods = viewType === 'yearly'
                    ? Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`)
                    : selectedPeriods;
                  
                  // Compute gross contributions
                  const grossEarnings = Number(p.profitShare) + Number(p.salariesPaid) + Number(p.expensesPaid);

                  return (
                    <div
                      key={p.partnerId}
                      className="border border-slate-800 rounded-2xl p-5 bg-slate-950/25 flex flex-col justify-between space-y-4 shadow-lg hover:border-slate-700/85 transition-all duration-350"
                    >
                      {/* Partner Identity Header */}
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <span className="font-bold text-white text-base flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 mr-2" />
                          {p.partnerName}
                        </span>
                        {viewType === 'monthly' && p.ownershipPercentage !== undefined && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-850">
                            Ownership: {p.ownershipPercentage?.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      {/* Cash Flow Step-by-Step Breakdown */}
                      <div className="flex-1 space-y-4 text-xs">
                        {/* Section 1: Earnings & Outlays */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/40 pb-1">
                            Earnings & Outlays (+)
                          </p>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'profit_share', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="Audit Profit Share breakdown"
                          >
                            <span>Profit Share (Base Earnings):</span>
                            <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 whitespace-nowrap">{formatCurrency(p.profitShare)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'salaries_paid', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View paid salaries list"
                          >
                            <span>Salaries Paid Personally:</span>
                            <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 whitespace-nowrap">+{formatCurrency(p.salariesPaid)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'expenses_paid', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View paid expenses list"
                          >
                            <span>Expenses Paid Personally:</span>
                            <span className="font-semibold text-slate-200 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 whitespace-nowrap">+{formatCurrency(p.expensesPaid)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'adjustments', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View adjustments ledger"
                          >
                            <span>Net Adjustments:</span>
                            <span className={`font-semibold group-hover:text-cyan-400 underline decoration-dotted decoration-slate-600 whitespace-nowrap ${p.netAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {p.netAdjustment >= 0 ? '+' : ''}{formatCurrency(p.netAdjustment)}
                            </span>
                          </div>
                          
                          {/* Gross Earnings Subtotal */}
                          <div className="flex justify-between border-t border-slate-800/40 pt-1.5 font-semibold text-[11px] text-slate-350">
                            <span>Gross Earnings Owed:</span>
                            <span className="whitespace-nowrap">{formatCurrency(grossEarnings + Number(p.netAdjustment))}</span>
                          </div>
                        </div>

                        {/* Section 2: Money Already Received */}
                        <div className="space-y-2 bg-slate-900/10 p-3 rounded-xl border border-slate-800/40">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/30 pb-1">
                            Draws & Withdrawals (–)
                          </p>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'client_direct', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View received direct salaries"
                          >
                            <span>Client Direct Salary Received:</span>
                            <span className="font-medium text-rose-500/80 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650 whitespace-nowrap">-{formatCurrency(p.clientDirectSalaryReceived)}</span>
                          </div>
                          <div 
                            onClick={() => handleDrilldown(p.partnerId, p.partnerName, 'project_payments', drilldownPeriods)}
                            className="flex justify-between text-slate-400 cursor-pointer hover:text-cyan-400 group transition-colors"
                            title="View received project payments"
                          >
                            <span>Project Payments Received:</span>
                            <span className="font-medium text-rose-500/80 group-hover:text-cyan-400 underline decoration-dotted decoration-slate-650 whitespace-nowrap">-{formatCurrency(p.companyMoneyReceived)}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-800/40 pt-1.5 font-bold text-slate-300">
                            <span>Total Money Received:</span>
                            <span className="text-amber-400 whitespace-nowrap">{formatCurrency(p.totalCompanyMoneyReceived)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Final Settlement Balance */}
                      <div className={`p-4 rounded-xl flex flex-col space-y-2 font-bold text-sm border ${
                        isReceivable 
                          ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                          : 'bg-rose-500/5 border-rose-500/10 text-rose-500'
                      }`}>
                        <div className="flex justify-between items-center w-full">
                          <span className="flex items-center space-x-1.5">
                            {isReceivable ? (
                              <>
                                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                                <span>Receivable (Owed to Partner)</span>
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="h-4 w-4 text-rose-500" />
                                <span>Payable (Owed to Company)</span>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => openBreakdownModal(p.partnerName, p)}
                              className="p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                              title="Show Calculation Breakdown"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </span>
                          <span className="text-base font-extrabold whitespace-nowrap">{formatCurrency(p.netBalance)}</span>
                        </div>

                        {hasSettledPeriods() && (() => {
                          const breakdown = getPartnerFinancialBreakdown(p.partnerId);
                          const formatSigned = (val: number) => {
                            const formatted = formatCurrency(Math.abs(val));
                            if (val > 0) return `+${formatted}`;
                            if (val < 0) return `-${formatted}`;
                            return `₹0.00`;
                          };
                          return (
                            <div className="pt-2 border-t border-slate-800/40 space-y-1 text-[11px] text-slate-400 font-medium">
                              <div className="flex justify-between">
                                <span>Total Net Balance:</span>
                                <span className={`font-bold ${breakdown.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatSigned(breakdown.total)}
                                </span>
                              </div>
                              <div className="flex justify-between text-emerald-400/90">
                                <span className="flex items-center">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                  Settled:
                                </span>
                                <span className="font-bold">{formatSigned(breakdown.settled)}</span>
                              </div>
                              <div className="flex justify-between text-amber-500/95">
                                <span className="flex items-center">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                  Outstanding:
                                </span>
                                <span className="font-bold">{formatSigned(breakdown.unsettled)}</span>
                              </div>
                            </div>
                          );
                        })()}
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
                  {displaySettlements?.filter((p: any) => p.netBalance >= 0).length === 0 ? (
                    <p className="text-sm text-slate-500">No partner receivables for this period.</p>
                  ) : (
                    displaySettlements
                      ?.filter((p: any) => p.netBalance >= 0)
                      .map((p: any) => {
                        const breakdown = getPartnerFinancialBreakdown(p.partnerId);
                        return (
                          <div
                            key={p.partnerId}
                            className="flex flex-col p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-white">{p.partnerName}</span>
                              <span className="text-sm font-bold text-emerald-400">{formatCurrency(p.netBalance)}</span>
                            </div>
                            
                            {hasSettledPeriods() && (
                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/10 text-[10px] text-slate-400">
                                <div>
                                  <p className="text-slate-500 uppercase tracking-wider font-bold text-[8px]">Total</p>
                                  <p className="font-semibold text-slate-350">{formatCurrency(Math.abs(breakdown.total))}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-500/70 uppercase tracking-wider font-bold text-[8px]">Settled</p>
                                  <p className="font-semibold text-emerald-400">{formatCurrency(Math.abs(breakdown.settled))}</p>
                                </div>
                                <div>
                                  <p className="text-amber-500/70 uppercase tracking-wider font-bold text-[8px]">Outstanding</p>
                                  <p className="font-semibold text-amber-400">{formatCurrency(Math.abs(breakdown.unsettled))}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Payables (Partner owes Company) */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-base font-bold text-rose-400 flex items-center">
                  <ArrowDownLeft className="h-5 w-5 mr-1.5" /> Payables (Owed by Partner)
                </h4>
                <div className="space-y-3">
                  {displaySettlements?.filter((p: any) => p.netBalance < 0).length === 0 ? (
                    <p className="text-sm text-slate-500">No partner payables for this period.</p>
                  ) : (
                    displaySettlements
                      ?.filter((p: any) => p.netBalance < 0)
                      .map((p: any) => {
                        const breakdown = getPartnerFinancialBreakdown(p.partnerId);
                        return (
                          <div
                            key={p.partnerId}
                            className="flex flex-col p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-white">{p.partnerName}</span>
                              <span className="text-sm font-bold text-rose-400">
                                {formatCurrency(Math.abs(p.netBalance))}
                              </span>
                            </div>
                            
                            {hasSettledPeriods() && (
                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-500/10 text-[10px] text-slate-400">
                                <div>
                                  <p className="text-slate-500 uppercase tracking-wider font-bold text-[8px]">Total</p>
                                  <p className="font-semibold text-slate-350">{formatCurrency(Math.abs(breakdown.total))}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-500/70 uppercase tracking-wider font-bold text-[8px]">Settled</p>
                                  <p className="font-semibold text-emerald-400">{formatCurrency(Math.abs(breakdown.settled))}</p>
                                </div>
                                <div>
                                  <p className="text-amber-500/70 uppercase tracking-wider font-bold text-[8px]">Outstanding</p>
                                  <p className="font-semibold text-amber-400">{formatCurrency(Math.abs(breakdown.unsettled))}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
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

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        type={confirmConfig.type}
      />

      {bulkProgress.active && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-5 shadow-2xl relative">
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-bold text-white">
                {bulkProgress.mode === 'settling' ? 'Settling Periods...' : 'Reopening Periods...'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Please wait while we update period settlement statuses.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Progress</span>
                <span className="text-cyan-400">
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]" 
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  Updated {bulkProgress.current} of {bulkProgress.total} periods
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <CalculationBreakdownModal
        isOpen={breakdownModalOpen}
        onClose={() => setBreakdownModalOpen(false)}
        partnerName={breakdownModalPartner}
        data={breakdownModalData}
      />
    </SidebarLayout>
  );
}
