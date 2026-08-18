'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SidebarLayout from '@/components/SidebarLayout';
import FinancialFilterBar from '@/components/FinancialFilterBar';
import Pagination from '@/components/Pagination';
import CSVImportModal from '@/components/CSVImportModal';
import { useAuth } from '@/context/AuthContext';
import { exportToCSV } from '@/lib/csvExport';
import { Plus, Edit2, Trash2, Calendar, User, DollarSign, Tag, Upload } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Expense {
  id: string;
  amount: string | number;
  category: string;
  expenseDate: string;
  description: string;
  partnerId: string;
  partner: Partner;
}

function ExpensesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Abort Controllers
  const abortControllerRootsRef = useRef<AbortController | null>(null);
  const abortControllerExpensesRef = useRef<AbortController | null>(null);

  // Root Data Lists
  const [partnersList, setPartnersList] = useState<Partner[]>([]);

  // Table Data & Paginated aggregates
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<any>({
    totalExpenses: 0,
    numberOfExpenses: 0,
    expensesPaidByPartner: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);

  // Categories list
  const categories = ['Office', 'Software', 'Utility', 'Travel', 'Marketing', 'Consulting', 'Other'];

  // Initial Filter State parsed from URL
  const [filters, setFilters] = useState({
    periodType: (searchParams.get('periodType') || 'monthly') as 'all' | 'monthly' | 'yearly' | 'custom',
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear(),
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : new Date().getMonth() + 1,
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    partnerId: searchParams.get('partnerId') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    limit: 10,
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [expenseIdToEdit, setExpenseIdToEdit] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Office');
  const [expenseDate, setExpenseDate] = useState('');
  const [expensePeriodMonth, setExpensePeriodMonth] = useState(new Date().getMonth() + 1);
  const [expensePeriodYear, setExpensePeriodYear] = useState(new Date().getFullYear());
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expensePartnerId, setExpensePartnerId] = useState('');

  // Update URL parameters
  const updateURL = (updatedFilters: any) => {
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });
    router.push(`/expenses?${params.toString()}`);
  };

  // Sync state filters when URL query changes
  useEffect(() => {
    setFilters({
      periodType: (searchParams.get('periodType') || 'monthly') as any,
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear(),
      month: searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : new Date().getMonth() + 1,
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      partnerId: searchParams.get('partnerId') || '',
      category: searchParams.get('category') || '',
      search: searchParams.get('search') || '',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      limit: 10,
    });
  }, [searchParams]);

  // Load partners list
  const loadRoots = async () => {
    if (abortControllerRootsRef.current) {
      abortControllerRootsRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRootsRef.current = controller;

    try {
      const res = await fetch('/api/partners', { signal: controller.signal });
      if (res.ok) {
        setPartnersList(await res.json());
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load partners list:', err);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadRoots();
    }
  }, [user]);

  // Load Expenses based on active filters
  const loadExpensesData = async () => {
    if (abortControllerExpensesRef.current) {
      abortControllerExpensesRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerExpensesRef.current = controller;

    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });

    try {
      const resExp = await fetch(`/api/expenses?${params.toString()}`, { signal: controller.signal });
      if (!resExp.ok) throw new Error('Failed to load expenses details');

      const data = await resExp.json();
      setExpenses(data.items);
      setTotalCount(data.total);
      setTotalPages(data.totalPages);
      setSummary(data.summary);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (abortControllerExpensesRef.current === controller) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadExpensesData();
    }
  }, [user, filters]);

  useEffect(() => {
    return () => {
      if (abortControllerRootsRef.current) {
        abortControllerRootsRef.current.abort();
      }
      if (abortControllerExpensesRef.current) {
        abortControllerExpensesRef.current.abort();
      }
    };
  }, []);

  // Handle filter changes
  const handleFilterChange = (updated: any) => {
    updateURL(updated);
  };

  // Clear all filters
  const handleClearFilters = () => {
    const cleared = {
      periodType: 'monthly' as const,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      startDate: '',
      endDate: '',
      partnerId: '',
      category: '',
      search: '',
      page: 1,
      limit: 10,
    };
    updateURL(cleared);
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Paid By Partner'];
    const rows = expenses.map((exp) => [
      formatDate(exp.expenseDate),
      exp.description,
      exp.category,
      exp.amount,
      exp.partner.name,
    ]);

    exportToCSV(`expenses-export-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  // Submit Expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = expenseIdToEdit ? `/api/expenses/${expenseIdToEdit}` : '/api/expenses';
    const method = expenseIdToEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(expenseAmount),
          category: expenseCategory,
          expenseDate,
          description: expenseDesc,
          partnerId: expensePartnerId,
          applicableMonth: expensePeriodMonth,
          applicableYear: expensePeriodYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense');

      setShowModal(false);
      resetForm();
      loadExpensesData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setExpenseIdToEdit(null);
    setExpenseAmount('');
    setExpenseCategory('Office');
    setExpenseDate('');
    setExpensePeriodMonth(new Date().getMonth() + 1);
    setExpensePeriodYear(new Date().getFullYear());
    setExpenseDesc('');
    setExpensePartnerId('');
  };

  const openNewExpense = () => {
    resetForm();
    const activeParts = partnersList.filter(p => p.isActive);
    if (activeParts.length > 0) setExpensePartnerId(activeParts[0].id);
    setShowModal(true);
  };

  const openEditExpense = (exp: any) => {
    setExpenseIdToEdit(exp.id);
    setExpenseAmount(Number(exp.amount).toString());
    setExpenseCategory(exp.category);
    const dateStr = new Date(exp.expenseDate).toISOString().split('T')[0];
    setExpenseDate(dateStr);
    setExpensePeriodMonth(exp.applicableMonth ?? (new Date(exp.expenseDate).getMonth() + 1));
    setExpensePeriodYear(exp.applicableYear ?? new Date(exp.expenseDate).getFullYear());
    setExpenseDesc(exp.description);
    setExpensePartnerId(exp.partnerId);
    setShowModal(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense? This is a soft-delete and will update reports instantly.')) return;
    setError('');
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete expense');
      loadExpensesData();
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
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Company Expenses</h1>
            <p className="text-slate-400 mt-1">Manage office outlays paid personally by partners</p>
          </div>
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Upload className="mr-2 h-4 w-4 text-cyan-400" /> Import CSV
            </button>
            <button
              onClick={openNewExpense}
              disabled={partnersList.filter(p => p.isActive).length === 0}
              className="flex items-center px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Expense
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <FinancialFilterBar
          partners={partnersList}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          onExportCSV={handleExportCSV}
          totalCount={totalCount}
        >
          {/* Custom Category selector */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange({ ...filters, category: e.target.value, page: 1 })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[150px]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </FinancialFilterBar>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Filtered aggregates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-bold text-orange-400 mt-2">{formatCurrency(summary.totalExpenses)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Expenses Count</p>
            <p className="text-2xl font-bold text-white mt-2">{summary.numberOfExpenses}</p>
          </div>
          {/* Partner Outlay Breakdowns */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80 space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paid by Partner</p>
            <div className="space-y-1 max-h-16 overflow-y-auto pr-1">
              {summary.expensesPaidByPartner?.length === 0 ? (
                <p className="text-xs text-slate-500">No partner outlays.</p>
              ) : (
                summary.expensesPaidByPartner?.map((p: any) => (
                  <div key={p.partnerId} className="flex justify-between text-xs text-slate-300">
                    <span className="truncate max-w-[120px]">{p.partnerName}:</span>
                    <span className="font-semibold text-cyan-400">{formatCurrency(p.amountPaid)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
        ) : (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-slate-400 text-left font-semibold">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 px-4">Period</th>
                    <th className="pb-3 px-4">Description</th>
                    <th className="pb-3 px-4">Category</th>
                    <th className="pb-3 px-4">Paid By Partner</th>
                    <th className="pb-3 px-4 text-right">Amount</th>
                    <th className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No company expenses match your filters.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp: any) => (
                      <tr key={exp.id} className="text-slate-300 hover:bg-slate-800/10">
                        <td className="py-4 pr-4 font-mono text-xs text-slate-400">
                          {formatDate(exp.expenseDate)}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-300">
                          {exp.applicableMonth ? `${exp.applicableMonth.toString().padStart(2, '0')}/${exp.applicableYear}` : 'N/A'}
                        </td>
                        <td className="py-4 px-4 font-semibold text-white truncate max-w-[200px]">{exp.description}</td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center text-xs text-slate-300 bg-slate-850 px-2 py-0.5 rounded-md border border-slate-700">
                            <Tag className="h-3 w-3 mr-1 text-cyan-400" />
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center text-xs text-slate-300 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700">
                            <User className="h-3 w-3 mr-1 text-cyan-400" />
                            {exp.partner.name}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-orange-400">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-4 pl-4 text-right space-x-1.5">
                          <button
                            onClick={() => openEditExpense(exp)}
                            className="inline-block p-1 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="inline-block p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              page={filters.page}
              totalPages={totalPages}
              totalItems={totalCount}
              limit={filters.limit}
              onPageChange={(page) => handleFilterChange({ ...filters, page })}
            />
          </div>
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <CSVImportModal
            type="expenses"
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              loadRoots();
              loadExpensesData();
            }}
          />
        )}

        {/* Expense Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {expenseIdToEdit ? 'Edit Expense Record' : 'Add Company Expense'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., AWS Cloud Bill"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-950 text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Paid By (Partner)</label>
                  <select
                    value={expensePartnerId}
                    onChange={(e) => setExpensePartnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {partnersList.map((p) => (
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
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="120.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Month</label>
                    <select
                      value={expensePeriodMonth}
                      onChange={(e) => setExpensePeriodMonth(parseInt(e.target.value, 10))}
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
                      value={expensePeriodYear}
                      onChange={(e) => setExpensePeriodYear(parseInt(e.target.value, 10))}
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
                    Save Expense
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

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#090b11]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
      </div>
    }>
      <ExpensesContent />
    </Suspense>
  );
}
