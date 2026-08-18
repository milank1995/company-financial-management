'use client';

import React, { useEffect, useState, useRef } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit2, Trash2, Calendar, User } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
}

interface Adjustment {
  id: string;
  partnerId: string;
  amount: string | number;
  type: string;
  adjustmentDate: string;
  description: string;
  partner: Partner;
}

export default function AdjustmentsPage() {
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [settlementStatuses, setSettlementStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [adjustmentIdToEdit, setAdjustmentIdToEdit] = useState<string | null>(null);
  const [adjustmentPartnerId, setAdjustmentPartnerId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('CREDIT');
  const [adjustmentDate, setAdjustmentDate] = useState('');
  const [adjustmentPeriodMonth, setAdjustmentPeriodMonth] = useState(new Date().getMonth() + 1);
  const [adjustmentPeriodYear, setAdjustmentPeriodYear] = useState(new Date().getFullYear());
  const [adjustmentDesc, setAdjustmentDesc] = useState('');

  const types = [
    { value: 'CREDIT', label: 'Credit (Partner Injecting Funds)' },
    { value: 'DEBIT', label: 'Debit (Partner Withdrawal)' },
    { value: 'LOAN', label: 'Loan (Partner Lending to Company)' },
    { value: 'WITHDRAWAL', label: 'Withdrawal' },
    { value: 'OTHER', label: 'Other Adjustment' },
  ];

  const loadData = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const [resAdj, resPart] = await Promise.all([
        fetch('/api/adjustments', { signal: controller.signal }),
        fetch('/api/partners', { signal: controller.signal }),
      ]);

      if (!resAdj.ok || !resPart.ok) {
        throw new Error('Failed to load adjustment details');
      }

      const adjs = await resAdj.json();
      const parts = await resPart.json();

      setAdjustments(adjs);
      setPartners(parts.filter((p: any) => p.isActive));
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

  const fetchSettlementStatuses = async () => {
    try {
      const res = await fetch('/api/settlement/status');
      if (res.ok) {
        setSettlementStatuses(await res.json());
      }
    } catch (err) {
      console.error('Failed to load settlement statuses:', err);
    }
  };

  const isPeriodSettled = (month?: number, year?: number) => {
    if (!month || !year) return false;
    return settlementStatuses.some((s) => s.year === year && s.month === month && s.isSettled);
  };

  useEffect(() => {
    if (user) {
      loadData();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Ensure negative values are stored for Debits/Withdrawals if positive entered, and vice versa.
    // Let's decide:
    // CREDIT / LOAN: positive amount
    // DEBIT / WITHDRAWAL: negative amount
    let finalAmount = Math.abs(parseFloat(adjustmentAmount));
    if (adjustmentType === 'DEBIT' || adjustmentType === 'WITHDRAWAL') {
      finalAmount = -finalAmount;
    }

    try {
      const res = await fetch(
        adjustmentIdToEdit ? `/api/adjustments/${adjustmentIdToEdit}` : '/api/adjustments',
        {
          method: adjustmentIdToEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: adjustmentPartnerId,
            amount: finalAmount,
            type: adjustmentType,
            adjustmentDate,
            applicableMonth: adjustmentPeriodMonth,
            applicableYear: adjustmentPeriodYear,
            description: adjustmentDesc,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save adjustment');

      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setAdjustmentIdToEdit(null);
    setAdjustmentPartnerId('');
    setAdjustmentAmount('');
    setAdjustmentType('CREDIT');
    setAdjustmentDate('');
    setAdjustmentPeriodMonth(new Date().getMonth() + 1);
    setAdjustmentPeriodYear(new Date().getFullYear());
    setAdjustmentDesc('');
  };

  const openNewAdjustment = () => {
    resetForm();
    if (partners.length > 0) setAdjustmentPartnerId(partners[0].id);
    setShowModal(true);
  };

  const openEditAdjustment = (adj: any) => {
    setAdjustmentIdToEdit(adj.id);
    setAdjustmentPartnerId(adj.partnerId);
    setAdjustmentAmount(Math.abs(Number(adj.amount)).toString());
    setAdjustmentType(adj.type);
    const dateStr = new Date(adj.adjustmentDate).toISOString().split('T')[0];
    setAdjustmentDate(dateStr);
    setAdjustmentPeriodMonth(adj.applicableMonth ?? (new Date(adj.adjustmentDate).getMonth() + 1));
    setAdjustmentPeriodYear(adj.applicableYear ?? new Date(adj.adjustmentDate).getFullYear());
    setAdjustmentDesc(adj.description);
    setShowModal(true);
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this adjustment? This is a soft-delete and will update aggregates instantly.')) return;
    setError('');
    try {
      const res = await fetch(`/api/adjustments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete adjustment');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatCurrency = (val: any) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(val));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Partner Adjustments</h1>
            <p className="text-slate-400 mt-1">Manage partner loans, withdrawals, credits, and capital injections</p>
          </div>
          <button
            onClick={openNewAdjustment}
            disabled={partners.length === 0}
            className="flex items-center px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Adjustment
          </button>
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
        ) : (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white mb-2">Adjustments Log</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-slate-400 text-left font-semibold">
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 px-4">Partner</th>
                    <th className="pb-3 px-4">Type</th>
                    <th className="pb-3 px-4">Date</th>
                    <th className="pb-3 px-4">Period</th>
                    <th className="pb-3 px-4 text-right">Amount</th>
                    <th className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No adjustments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj: any) => {
                      const settled = isPeriodSettled(adj.applicableMonth, adj.applicableYear);
                      return (
                        <tr
                          key={adj.id}
                          className={`transition-colors border-l-2 ${
                            settled
                              ? 'bg-slate-950/20 opacity-70 border-emerald-500/30 text-slate-450 select-none'
                              : 'hover:bg-slate-800/10 border-transparent text-slate-350'
                          }`}
                        >
                          <td className="py-4 pr-4">
                            <div>
                              <p className={`font-medium ${settled ? 'text-slate-400 font-normal' : 'text-white'}`}>{adj.description}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center text-xs text-slate-300 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700">
                              <User className="h-3 w-3 mr-1 text-cyan-400" />
                              {adj.partner.name}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                              Number(adj.amount) >= 0
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                              {adj.type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 font-mono text-xs">
                            <span className="flex items-center">
                              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-500" />
                              {formatDate(adj.adjustmentDate)}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-300">
                            {adj.applicableMonth ? `${adj.applicableMonth.toString().padStart(2, '0')}/${adj.applicableYear}` : 'N/A'}
                          </td>
                          <td className={`py-4 px-4 text-right font-bold ${
                            settled ? 'text-slate-400' : (Number(adj.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400')
                          }`}>
                            {formatCurrency(adj.amount)}
                            {settled && <span className="text-emerald-500 text-[10px] ml-1">✓</span>}
                          </td>
                          <td className="py-4 pl-4 text-right">
                            {settled ? (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                Reconciled
                              </span>
                            ) : (
                              <div className="space-x-2 inline-block">
                                <button
                                  onClick={() => openEditAdjustment(adj)}
                                  className="inline-block p-1 text-slate-400 hover:text-white"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAdjustment(adj.id)}
                                  className="inline-block p-1 text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
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

        {/* Adjustment Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {adjustmentIdToEdit ? 'Edit Adjustment Record' : 'Add Partner Adjustment'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    required
                    value={adjustmentDesc}
                    onChange={(e) => setAdjustmentDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., Partner Loan to Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {types.map((t) => (
                      <option key={t.value} value={t.value} className="bg-slate-950 text-white">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Partner</label>
                  <select
                    value={adjustmentPartnerId}
                    onChange={(e) => setAdjustmentPartnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="5000.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Adjustment Date</label>
                  <input
                    type="date"
                    required
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Month</label>
                    <select
                      value={adjustmentPeriodMonth}
                      onChange={(e) => setAdjustmentPeriodMonth(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1).toLocaleString('en-US', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Year</label>
                    <select
                      value={adjustmentPeriodYear}
                      onChange={(e) => setAdjustmentPeriodYear(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Save Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
