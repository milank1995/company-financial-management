'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CalendarDays, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

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
  const [selectedMonth, setSelectedMonth] = useState<number>(8); // August
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    const url =
      viewType === 'monthly'
        ? `/api/dashboard/monthly?year=${selectedYear}&month=${selectedMonth}`
        : `/api/dashboard/yearly?year=${selectedYear}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch settlement data');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, viewType, selectedYear, selectedMonth]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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
                ? `Calculated net balances for ${months.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`
                : `Aggregated year-to-date settlements for ${selectedYear}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Type Toggle */}
            <div className="bg-[#0f172a] p-1 rounded-lg border border-[#1e293b] flex">
              <button
                onClick={() => setViewType('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  viewType === 'monthly'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewType('yearly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                  viewType === 'yearly'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Year Selector */}
            <div className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-2 py-1">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-white text-sm focus:outline-none border-none pr-6 py-1"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-[#0f172a] text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector (only for monthly view) */}
            {viewType === 'monthly' && (
              <div className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-2 py-1">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="bg-transparent text-white text-sm focus:outline-none border-none pr-6 py-1"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#0f172a] text-white">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={fetchData}
              className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:text-white border border-slate-700 hover:bg-slate-700 transition-colors"
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
              <div className="overflow-x-auto">
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
                    {data.partnerSettlements?.map((p: SettlementItem) => (
                      <tr key={p.partnerId} className="text-slate-300 hover:bg-slate-800/10">
                        <td className="py-4 pr-4 font-semibold text-white">{p.partnerName}</td>
                        {viewType === 'monthly' && (
                          <td className="py-4 px-4 text-right font-medium text-cyan-400">
                            {p.ownershipPercentage?.toFixed(2)}%
                          </td>
                        )}
                        <td className="py-4 px-4 text-right">{formatCurrency(p.profitShare)}</td>
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.salariesPaid)}</td>
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.expensesPaid)}</td>
                        <td className={`py-4 px-4 text-right ${p.netAdjustment >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          {p.netAdjustment >= 0 ? '+' : ''}{formatCurrency(p.netAdjustment)}
                        </td>
                        <td className="py-4 px-4 text-right text-orange-400">{formatCurrency(p.clientDirectSalaryReceived)}</td>
                        <td className="py-4 px-4 text-right bg-slate-900/30 text-amber-400 font-semibold border-l border-slate-850">
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
                    ))}
                  </tbody>
                </table>
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
    </SidebarLayout>
  );
}
