'use client';

import React, { useEffect, useState } from 'react';
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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([8]); // August
  const [monthsDropdownOpen, setMonthsDropdownOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
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

  const toggleMonth = (mVal: number) => {
    setSelectedMonths((prev) => {
      if (prev.includes(mVal)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mVal);
      } else {
        return [...prev, mVal].sort((a, b) => a - b);
      }
    });
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    let url =
      viewType === 'monthly'
        ? `/api/dashboard/monthly?year=${selectedYear}&month=${selectedMonths.join(',')}`
        : `/api/dashboard/yearly?year=${selectedYear}`;

    if (selectedPartnerId) {
      url += `&partnerId=${selectedPartnerId}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
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
  }, [user, viewType, selectedYear, selectedMonths, selectedPartnerId]);

  if (authLoading) return null;

  const partnerSettlement = selectedPartnerId && data
    ? data.partnerSettlements?.find((p: any) => p.partnerId === selectedPartnerId)
    : null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMonthsDropdownOpen(!monthsDropdownOpen)}
                  className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-3 py-2 text-white text-sm hover:bg-[#1e293b] transition-colors"
                >
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <span>
                    {selectedMonths.length === 12
                      ? 'All Months'
                      : selectedMonths.length === 0
                      ? 'Select Month'
                      : selectedMonths.map((m) => months.find((mo) => mo.value === m)?.label.substring(0, 3)).join(', ')}
                  </span>
                </button>

                {monthsDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMonthsDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-[#0b0f19] border border-slate-800 rounded-xl shadow-xl z-20 p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Months</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMonths.length === 12) {
                              setSelectedMonths([new Date().getMonth() + 1]);
                            } else {
                              setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                            }
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          {selectedMonths.length === 12 ? 'Clear All' : 'Select All'}
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {months.map((m) => {
                          const isChecked = selectedMonths.includes(m.value);
                          return (
                            <label
                              key={m.value}
                              className="flex items-center space-x-2 text-sm text-slate-355 hover:text-white cursor-pointer select-none py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleMonth(m.value)}
                                className="rounded border-slate-800 bg-slate-900 text-cyan-500 focus:ring-cyan-500/25 h-4 w-4"
                              />
                              <span>{m.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Partner Selector */}
            <div className="flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-2 py-1">
              <Users className="h-4 w-4 text-slate-400" />
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="bg-transparent text-white text-sm focus:outline-none border-none pr-6 py-1"
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
              className="p-2 bg-[#0f172a] text-slate-450 rounded-lg hover:text-white border border-[#1e293b] hover:bg-[#1e293b] transition-colors flex items-center justify-center"
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
                    </div>
                    <div className="mt-6 border-t border-slate-800 pt-4 text-center">
                      <p className="text-xs text-slate-400 font-medium">
                        Operating Margin for {selectedMonths.length === 12 ? 'Year' : selectedMonths.map(m => months.find(mo => mo.value === m)?.label.substring(0, 3)).join(', ')} {selectedYear}
                      </p>
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

            {/* Partner Financial Summary Table */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 w-full overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Partner Financial Summary</h3>
                <span className="text-xs text-slate-400">Dynamic breakdown per partner</span>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-slate-800 text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 text-left font-semibold">
                      <th className="pb-3 pr-4">Partner</th>
                      {viewType === 'monthly' && <th className="pb-3 px-4 text-right">Ownership %</th>}
                      <th className="pb-3 px-4 text-right">Salary Paid Personally</th>
                      <th className="pb-3 px-4 text-right">Salary Received (Client Direct)</th>
                      <th className="pb-3 px-4 text-right">Company Expenses Paid</th>
                      <th className="pb-3 px-4 text-right">Project Income Received</th>
                      <th className="pb-3 px-4 text-right text-amber-400">Total Money Received</th>
                      <th className="pb-3 px-4 text-right">Profit Share</th>
                      <th className="pb-3 px-4 text-right text-emerald-500">Other Credits</th>
                      <th className="pb-3 px-4 text-right text-rose-500">Other Debits</th>
                      <th className="pb-3 pl-6 text-right bg-slate-900/60 rounded-t-lg">Final Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(partnerSettlement ? [partnerSettlement] : data.partnerSettlements || []).map((p: any) => (
                      <tr key={p.partnerId} className="text-slate-300 hover:bg-slate-800/10">
                        <td className="py-4 pr-4 font-semibold text-white">{p.partnerName}</td>
                        {viewType === 'monthly' && (
                          <td className="py-4 px-4 text-right font-medium text-cyan-400">
                            {p.ownershipPercentage?.toFixed(2)}%
                          </td>
                        )}
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.salariesPaid)}</td>
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.clientDirectSalaryReceived)}</td>
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.expensesPaid)}</td>
                        <td className="py-4 px-4 text-right text-slate-400">{formatCurrency(p.companyMoneyReceived)}</td>
                        <td className="py-4 px-4 text-right text-amber-400 font-medium">{formatCurrency(p.totalCompanyMoneyReceived)}</td>
                        <td className="py-4 px-4 text-right">{formatCurrency(p.profitShare)}</td>
                        <td className="py-4 px-4 text-right text-emerald-400">+{formatCurrency(p.credits)}</td>
                        <td className="py-4 px-4 text-right text-rose-500">-{formatCurrency(p.debits)}</td>
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
    </SidebarLayout>
  );
}
