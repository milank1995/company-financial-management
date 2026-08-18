'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Loader2, ArrowUpRight, ArrowDownLeft, TrendingUp, DollarSign } from 'lucide-react';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId?: string;
  partnerName?: string;
  periods: string[];
  type: 'profit_share' | 'salaries_paid' | 'expenses_paid' | 'client_direct' | 'project_payments' | 'adjustments' | 'credits' | 'debits';
  title?: string;
}

export default function DrilldownModal({
  isOpen,
  onClose,
  partnerId,
  partnerName = 'Company',
  periods,
  type,
  title
}: DrilldownModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profitTab, setProfitTab] = useState<'summary' | 'income' | 'salaries' | 'expenses' | 'ownership'>('summary');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset data when modal is closed to prevent rendering stale data on re-opening
  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError('');
      setLoading(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset states
    setData(null);
    setError('');
    setProfitTab('summary');
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchDetails = async () => {
      try {
        const queryParams = new URLSearchParams({
          type,
          periods: periods.join(','),
        });
        if (partnerId) {
          queryParams.append('partnerId', partnerId);
        }

        const res = await fetch(`/api/dashboard/drilldown?${queryParams.toString()}`, {
          signal: abortControllerRef.current?.signal
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to load details');
        }

        const details = await res.json();
        setData(details);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Something went wrong');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, partnerId, periods, type]);

  if (!isOpen) return null;

  const formatPeriod = (month?: number, year?: number) => {
    if (!month || !year) return 'N/A';
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${monthNames[month - 1] || 'Month ' + month} ${year}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  // CSV Exporter
  const exportToCSV = () => {
    if (!data) return;

    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `${type}_drilldown_${partnerName.replace(/\s+/g, '_')}.csv`;

    if (type === 'profit_share') {
      // Export custom multi-sheet or single flattened transaction report
      headers = ['Category', 'Date/Effective', 'Name/Description', 'Details/Role', 'Amount (INR)'];
      
      // Add Income
      (data.income || []).forEach((p: any) => {
        rows.push(['Project Payment (Income)', formatDate(p.paymentDate), p.project?.name || 'N/A', `Client: ${p.clientName || 'N/A'} (Received by: ${p.partner?.name || 'N/A'})`, p.amount]);
      });
      // Add Salaries
      (data.salaries || []).forEach((s: any) => {
        rows.push(['Salary Payment (Expense)', formatDate(s.paymentDate), s.employee?.name || 'N/A', `Source: ${s.paymentSource}`, -s.amount]);
      });
      // Add Expenses
      (data.expenses || []).forEach((e: any) => {
        rows.push(['Company Expense (Expense)', formatDate(e.expenseDate), e.description, `Category: ${e.category}`, -e.amount]);
      });
    } else {
      headers = ['Date', 'Description/Details', 'Reference Name', 'Amount (INR)'];
      const items = Array.isArray(data) ? data : [];
      items.forEach((item: any) => {
        const date = formatDate(item.paymentDate || item.expenseDate || item.adjustmentDate || item.createdAt);
        const desc = item.description || item.category || (type === 'salaries_paid' ? 'Salary Payment' : 'Project Payment');
        const refName = item.employee?.name || item.project?.name || item.type || 'N/A';
        rows.push([date, desc, refName, item.amount]);
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get dynamic modal labels
  const getModalTitle = () => {
    if (title) return title;
    switch (type) {
      case 'profit_share': return `Profit Share Audit Ledger`;
      case 'salaries_paid': return `Salaries Paid Personally`;
      case 'expenses_paid': return `Expenses Paid Personally`;
      case 'client_direct': return `Client Direct Salaries Received`;
      case 'project_payments': return `Project Payments Received`;
      case 'adjustments': return `Partner adjustments Ledger`;
      case 'credits': return `Partner Credits`;
      case 'debits': return `Partner Debits`;
      default: return `Financial Audit Logs`;
    }
  };

  // Calculation helpers for profit share summary
  const getProfitCalculation = () => {
    if (!data || type !== 'profit_share') return null;

    const totalIncome = (data.income || []).reduce((acc: number, item: any) => acc + Number(item.amount), 0);
    const totalSalaries = (data.salaries || []).reduce((acc: number, item: any) => acc + Number(item.amount), 0);
    const totalExpenses = (data.expenses || []).reduce((acc: number, item: any) => acc + Number(item.amount), 0);
    const grossProfit = totalIncome - totalSalaries - totalExpenses;

    // Find ownership percentage for partner during selected period range
    // For simplicity, grab the active ownership from the latest ownershipSetup
    let ownershipPercent = 0;
    if (data.ownershipSetups && data.ownershipSetups.length > 0) {
      const activeSetup = data.ownershipSetups[data.ownershipSetups.length - 1];
      const partnerObj = activeSetup.partnerOwnerships?.find((po: any) => po.partnerId === partnerId);
      if (partnerObj) {
        ownershipPercent = Number(partnerObj.percentage) * 100;
      }
    }

    const partnerShare = (grossProfit * ownershipPercent) / 100;

    return {
      totalIncome,
      totalSalaries,
      totalExpenses,
      grossProfit,
      ownershipPercent,
      partnerShare
    };
  };

  const calc = getProfitCalculation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/20">
          <div>
            <h3 className="text-base font-bold text-white flex items-center">
              <span className="h-2 w-2 rounded-full bg-cyan-400 mr-2" />
              {getModalTitle()}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditing details for <strong className="text-slate-350">{partnerName}</strong> across {periods.length} selected {periods.length === 1 ? 'period' : 'periods'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {data && !loading && (
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                title="Download CSV report"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-grow p-6 overflow-y-auto min-h-[300px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-400">Fetching detailed records from ledger...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-450 text-center">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Profit Share Multi-Tab System */}
              {type === 'profit_share' && calc && (
                <div className="space-y-6">
                  {/* Tabs Selector */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
                    <button
                      onClick={() => setProfitTab('summary')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        profitTab === 'summary' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Audit Calculation Summary
                    </button>
                    <button
                      onClick={() => setProfitTab('income')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        profitTab === 'income' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Project Income ({(data.income || []).length})
                    </button>
                    <button
                      onClick={() => setProfitTab('salaries')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        profitTab === 'salaries' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Employee Salaries ({(data.salaries || []).length})
                    </button>
                    <button
                      onClick={() => setProfitTab('expenses')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        profitTab === 'expenses' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Company Expenses ({(data.expenses || []).length})
                    </button>
                    <button
                      onClick={() => setProfitTab('ownership')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        profitTab === 'ownership' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Ownership Log
                    </button>
                  </div>

                  {/* Profit Share Summary Tab */}
                  {profitTab === 'summary' && (
                    <div className="space-y-6">
                      {/* Grid cards */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-4 space-y-1">
                          <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Gross Income</p>
                          <p className="text-lg font-bold text-white">{formatCurrency(calc.totalIncome)}</p>
                        </div>
                        <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-4 space-y-1">
                          <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Gross Salaries</p>
                          <p className="text-lg font-bold text-slate-350">{formatCurrency(calc.totalSalaries)}</p>
                        </div>
                        <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-xl p-4 space-y-1">
                          <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Gross Expenses</p>
                          <p className="text-lg font-bold text-slate-350">{formatCurrency(calc.totalExpenses)}</p>
                        </div>
                        <div className={`border rounded-xl p-4 space-y-1 ${
                          calc.grossProfit >= 0 ? 'bg-cyan-500/5 border-cyan-500/25' : 'bg-rose-500/5 border-rose-500/25'
                        }`}>
                          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Gross Profit</p>
                          <p className={`text-lg font-bold ${calc.grossProfit >= 0 ? 'text-cyan-400' : 'text-rose-550'}`}>
                            {formatCurrency(calc.grossProfit)}
                          </p>
                        </div>
                      </div>

                      {/* Formula Section */}
                      <div className="bg-[#0f172a]/20 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center">
                          <TrendingUp className="h-4 w-4 text-cyan-400 mr-2" />
                          Partner Profit Allocation Formula
                        </h4>
                        <div className="text-xs text-slate-355 space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                            <span>Calculated Company Gross Profit:</span>
                            <span className="font-semibold text-white">{formatCurrency(calc.grossProfit)}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                            <span>{partnerName}&apos;s Ownership share:</span>
                            <span className="font-semibold text-cyan-400">{calc.ownershipPercent.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center p-3.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-sm font-bold mt-2">
                            <span className="text-cyan-300">Partner Profit Share Allocation:</span>
                            <span className="text-cyan-400 text-base">{formatCurrency(calc.partnerShare)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Income Tab */}
                  {profitTab === 'income' && (
                    <div className="border border-slate-800 rounded-xl overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-800 text-xs">
                        <thead>
                          <tr className="text-slate-400 font-semibold bg-slate-950/20 text-left">
                            <th className="p-3">Payment Date</th>
                            <th className="p-3">Period</th>
                            <th className="p-3">Project</th>
                            <th className="p-3">Client</th>
                            <th className="p-3">Received By</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {(data.income || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500">No project payments received during these periods.</td>
                            </tr>
                          ) : (
                            (data.income || []).map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-800/10">
                                <td className="p-3">{formatDate(p.paymentDate)}</td>
                                <td className="p-3 text-slate-400 font-medium">{formatPeriod(p.applicableMonth, p.applicableYear)}</td>
                                <td className="p-3 font-semibold text-white">{p.project?.name || 'N/A'}</td>
                                <td className="p-3 text-slate-400">{p.clientName || 'N/A'}</td>
                                <td className="p-3 text-slate-400">{p.partner?.name || 'N/A'}</td>
                                <td className="p-3 text-right text-emerald-400 font-medium">{formatCurrency(Number(p.amount))}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Employee Salaries Tab */}
                  {profitTab === 'salaries' && (
                    <div className="border border-slate-800 rounded-xl overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-800 text-xs">
                        <thead>
                          <tr className="text-slate-400 font-semibold bg-slate-950/20 text-left">
                            <th className="p-3">Payment Date</th>
                            <th className="p-3">Period</th>
                            <th className="p-3">Employee</th>
                            <th className="p-3">Payment Source</th>
                            <th className="p-3">Paid By / Received By</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {(data.salaries || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500">No salary payments paid during these periods.</td>
                            </tr>
                          ) : (
                            (data.salaries || []).map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-800/10">
                                <td className="p-3">{formatDate(s.paymentDate)}</td>
                                <td className="p-3 text-slate-400 font-medium">{formatPeriod(s.applicableMonth, s.applicableYear)}</td>
                                <td className="p-3 font-semibold text-white">{s.employee?.name || 'N/A'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    s.paymentSource === 'COMPANY' 
                                      ? 'bg-blue-500/5 text-blue-450 border-blue-550/15'
                                      : s.paymentSource === 'PARTNER'
                                      ? 'bg-amber-500/5 text-amber-450 border-amber-550/15'
                                      : 'bg-teal-500/5 text-teal-450 border-teal-550/15'
                                  }`}>
                                    {s.paymentSource}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400">
                                  {s.paymentSource === 'PARTNER' && `Partner: ${s.partner?.name || 'N/A'}`}
                                  {s.paymentSource === 'CLIENT_DIRECT' && `Direct: ${s.receivedByPartner?.name || 'N/A'}`}
                                  {s.paymentSource === 'COMPANY' && 'Company Funds'}
                                </td>
                                <td className="p-3 text-right text-rose-400 font-medium">-{formatCurrency(Number(s.amount))}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Company Expenses Tab */}
                  {profitTab === 'expenses' && (
                    <div className="border border-slate-800 rounded-xl overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-800 text-xs">
                        <thead>
                          <tr className="text-slate-400 font-semibold bg-slate-950/20 text-left">
                            <th className="p-3">Expense Date</th>
                            <th className="p-3">Period</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Paid By Partner</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {(data.expenses || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500">No company expenses recorded during these periods.</td>
                            </tr>
                          ) : (
                            (data.expenses || []).map((e: any) => (
                              <tr key={e.id} className="hover:bg-slate-800/10">
                                <td className="p-3">{formatDate(e.expenseDate)}</td>
                                <td className="p-3 text-slate-400 font-medium">{formatPeriod(e.applicableMonth, e.applicableYear)}</td>
                                <td className="p-3 font-semibold text-white">{e.description}</td>
                                <td className="p-3 text-slate-400">{e.category}</td>
                                <td className="p-3 text-slate-400">{e.partner?.name || 'N/A'}</td>
                                <td className="p-3 text-right text-rose-400 font-medium">-{formatCurrency(Number(e.amount))}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Ownership Tab */}
                  {profitTab === 'ownership' && (
                    <div className="border border-slate-800 rounded-xl overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-800 text-xs">
                        <thead>
                          <tr className="text-slate-400 font-semibold bg-slate-950/20 text-left">
                            <th className="p-3">Effective Date</th>
                            <th className="p-3">Partner Share Breakdown</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {(data.ownershipSetups || []).length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-4 text-center text-slate-500">No ownership configurations found in ledger database.</td>
                            </tr>
                          ) : (
                            (data.ownershipSetups || []).map((setup: any) => (
                              <tr key={setup.id} className="hover:bg-slate-800/10">
                                <td className="p-3 font-semibold text-white">
                                  {new Date(setup.effectiveDate).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    timeZone: 'UTC'
                                  })}
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-2">
                                    {(setup.partnerOwnerships || []).map((po: any) => (
                                      <span key={po.id} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                                        {po.partner?.name}: <strong className="text-cyan-400">{(Number(po.percentage) * 100).toFixed(2)}%</strong>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Regular Drilldown List Table */}
              {type !== 'profit_share' && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/10">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800 text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-slate-400 font-semibold bg-slate-950/40 text-left">
                          <th className="p-3.5 pl-4">Date</th>
                          <th className="p-3.5">Period</th>
                          <th className="p-3.5">Category/Detail</th>
                          <th className="p-3.5">Reference Details</th>
                          <th className="p-3.5 text-right pr-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {!Array.isArray(data) || data.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-10 text-center text-slate-500 text-sm">
                              No matching transaction audit records found for this period.
                            </td>
                          </tr>
                        ) : (
                          data.map((item: any) => {
                            const date = item.paymentDate || item.expenseDate || item.adjustmentDate || item.createdAt;
                            const amt = Number(item.amount);
                            
                            // Category details
                            let detail = item.description || item.category || 'N/A';
                            let refDetails = 'N/A';

                            if (type === 'salaries_paid') {
                              detail = 'Salary Expense';
                              refDetails = `Employee: ${item.employee?.name || 'N/A'} (${item.employee?.role || 'N/A'})`;
                            } else if (type === 'client_direct') {
                              detail = `Client Salary (Direct)`;
                              refDetails = `Employee: ${item.employee?.name || 'N/A'} (Paid by: ${item.clientName || 'Client'})`;
                            } else if (type === 'project_payments') {
                              detail = `Project Payment`;
                              refDetails = `Project: ${item.project?.name || 'N/A'} (Paid by: ${item.clientName || 'Client'})`;
                            } else if (type === 'adjustments' || type === 'credits' || type === 'debits') {
                              detail = `${item.type} adjustment`;
                              refDetails = item.description;
                            }

                            // Dynamic amount styling
                            const isPositive = amt >= 0;
                            let amtStyle = 'text-white';
                            if (type === 'adjustments' || type === 'credits' || type === 'debits') {
                              amtStyle = isPositive ? 'text-emerald-400' : 'text-rose-500';
                            }

                            return (
                              <tr key={item.id} className="hover:bg-slate-800/10">
                                <td className="p-3.5 pl-4">{formatDate(date)}</td>
                                <td className="p-3.5 text-slate-400 font-medium">{formatPeriod(item.applicableMonth, item.applicableYear)}</td>
                                <td className="p-3.5 font-semibold text-white">
                                  {detail}
                                </td>
                                <td className="p-3.5 text-slate-400 max-w-xs truncate" title={refDetails}>
                                  {refDetails}
                                </td>
                                <td className={`p-3.5 text-right pr-4 font-bold ${amtStyle}`}>
                                  {formatCurrency(amt)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Summary Bar */}
        {!loading && !error && data && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-950/20 text-xs text-slate-400">
            {type === 'profit_share' && calc ? (
              <span>Calculated Share: <strong className="text-cyan-400 font-bold">{formatCurrency(calc.partnerShare)}</strong></span>
            ) : (
              <span>
                Total Records: <strong className="text-white">{Array.isArray(data) ? data.length : 0}</strong>
              </span>
            )}
            
            {type !== 'profit_share' && Array.isArray(data) && data.length > 0 && (
              <span>
                Sum Total:{' '}
                <strong className={`font-extrabold text-sm ml-1 ${
                  data.reduce((acc: number, item: any) => acc + Number(item.amount), 0) >= 0 ? 'text-cyan-400' : 'text-rose-500'
                }`}>
                  {formatCurrency(data.reduce((acc: number, item: any) => acc + Number(item.amount), 0))}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
