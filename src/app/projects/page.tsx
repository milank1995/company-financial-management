'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SidebarLayout from '@/components/SidebarLayout';
import FinancialFilterBar from '@/components/FinancialFilterBar';
import Pagination from '@/components/Pagination';
import CSVImportModal from '@/components/CSVImportModal';
import { useAuth } from '@/context/AuthContext';
import { exportToCSV } from '@/lib/csvExport';
import { Plus, Edit2, Trash2, Calendar, User, DollarSign, Upload } from 'lucide-react';
import ConfirmationModal from '@/components/ConfirmationModal';

interface Project {
  id: string;
  name: string;
  description: string | null;
  totalAmount: string | number;
  isActive: boolean;
}

interface Partner {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Payment {
  id: string;
  projectId: string;
  amount: string | number;
  paymentDate: string;
  partnerId: string;
  clientName: string | null;
  project: Project;
  partner: Partner;
}

function ProjectsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Abort Controllers
  const abortControllerRootsRef = useRef<AbortController | null>(null);
  const abortControllerPaymentsRef = useRef<AbortController | null>(null);

  // Root Data Lists
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [partnersList, setPartnersList] = useState<Partner[]>([]);

  // Settlement statuses state
  const [settlementStatuses, setSettlementStatuses] = useState<any[]>([]);

  // Table Data & Paginated aggregates
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<any>({
    totalProjectAmount: 0,
    totalAmountReceived: 0,
    numberOfPayments: 0,
    outstandingAmount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);

  // Initial Filter State parsed from URL
  const [filters, setFilters] = useState({
    periodType: (searchParams.get('periodType') || 'monthly') as 'all' | 'monthly' | 'yearly' | 'custom',
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear(),
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : new Date().getMonth() + 1,
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    partnerId: searchParams.get('partnerId') || '',
    projectId: searchParams.get('projectId') || '',
    search: searchParams.get('search') || '',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    limit: 10,
  });

  // Project Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectIdToEdit, setProjectIdToEdit] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectTotal, setProjectTotal] = useState('');
  const [projectIsActive, setProjectIsActive] = useState(true);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentIdToEdit, setPaymentIdToEdit] = useState<string | null>(null);
  const [paymentProjectId, setPaymentProjectId] = useState('');
  const [paymentPartnerId, setPaymentPartnerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentPeriodMonth, setPaymentPeriodMonth] = useState(new Date().getMonth() + 1);
  const [paymentPeriodYear, setPaymentPeriodYear] = useState(new Date().getFullYear());
  const [paymentClientName, setPaymentClientName] = useState('');

  // Update URL parameters
  const updateURL = (updatedFilters: any) => {
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });
    router.push(`/projects?${params.toString()}`);
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
      projectId: searchParams.get('projectId') || '',
      search: searchParams.get('search') || '',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      limit: 10,
    });
  }, [searchParams]);

  // Load root entities once
  const loadRoots = async () => {
    if (abortControllerRootsRef.current) {
      abortControllerRootsRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRootsRef.current = controller;

    try {
      const [resProj, resPart] = await Promise.all([
        fetch('/api/projects', { signal: controller.signal }),
        fetch('/api/partners', { signal: controller.signal }),
      ]);
      if (resProj.ok && resPart.ok) {
        setProjectsList(await resProj.json());
        setPartnersList(await resPart.json());
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load roots:', err);
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
      loadRoots();
      fetchSettlementStatuses();
    }
  }, [user]);

  // Load Payments based on active filters
  const loadPaymentsData = async () => {
    if (abortControllerPaymentsRef.current) {
      abortControllerPaymentsRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerPaymentsRef.current = controller;

    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });

    try {
      const resPay = await fetch(`/api/projects/payments?${params.toString()}`, { signal: controller.signal });
      if (!resPay.ok) throw new Error('Failed to load payments details');

      const data = await resPay.json();
      setPayments(data.items);
      setTotalCount(data.total);
      setTotalPages(data.totalPages);
      setSummary(data.summary);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (abortControllerPaymentsRef.current === controller) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      loadPaymentsData();
    }
  }, [user, filters]);

  useEffect(() => {
    return () => {
      if (abortControllerRootsRef.current) {
        abortControllerRootsRef.current.abort();
      }
      if (abortControllerPaymentsRef.current) {
        abortControllerPaymentsRef.current.abort();
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
      projectId: '',
      search: '',
      page: 1,
      limit: 10,
    };
    updateURL(cleared);
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Project', 'Client', 'Amount', 'Received By Partner', 'Notes'];
    const rows = payments.map((pay) => [
      formatDate(pay.paymentDate),
      pay.project.name,
      pay.clientName || 'N/A',
      pay.amount,
      pay.partner.name,
      pay.project.description || '',
    ]);

    exportToCSV(`project-payments-export-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  // Project Submit
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = projectIdToEdit ? `/api/projects/${projectIdToEdit}` : '/api/projects';
    const method = projectIdToEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc,
          totalAmount: parseFloat(projectTotal),
          isActive: projectIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save project');

      setShowProjectModal(false);
      resetProjectForm();
      loadRoots();
      loadPaymentsData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetProjectForm = () => {
    setProjectIdToEdit(null);
    setProjectName('');
    setProjectDesc('');
    setProjectTotal('');
    setProjectIsActive(true);
  };

  const openEditProject = (p: Project) => {
    setProjectIdToEdit(p.id);
    setProjectName(p.name);
    setProjectDesc(p.description || '');
    setProjectTotal(Number(p.totalAmount).toString());
    setProjectIsActive(p.isActive);
    setShowProjectModal(true);
  };

  const performDeleteProject = async (id: string) => {
    setError('');
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');
      loadRoots();
      loadPaymentsData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteProject = (id: string) => {
    triggerConfirm({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project?',
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => performDeleteProject(id),
    });
  };

  // Payment Submit
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = paymentIdToEdit ? `/api/projects/payments/${paymentIdToEdit}` : '/api/projects/payments';
    const method = paymentIdToEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: paymentProjectId,
          partnerId: paymentPartnerId,
          amount: parseFloat(paymentAmount),
          paymentDate,
          clientName: paymentClientName,
          applicableMonth: paymentPeriodMonth,
          applicableYear: paymentPeriodYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      setShowPaymentModal(false);
      resetPaymentForm();
      loadPaymentsData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetPaymentForm = () => {
    setPaymentIdToEdit(null);
    setPaymentProjectId('');
    setPaymentPartnerId('');
    setPaymentAmount('');
    setPaymentDate('');
    setPaymentPeriodMonth(new Date().getMonth() + 1);
    setPaymentPeriodYear(new Date().getFullYear());
    setPaymentClientName('');
  };

  const openNewPayment = () => {
    resetPaymentForm();
    if (projectsList.length > 0) setPaymentProjectId(projectsList[0].id);
    const activeParts = partnersList.filter(p => p.isActive);
    if (activeParts.length > 0) setPaymentPartnerId(activeParts[0].id);
    setShowPaymentModal(true);
  };

  const openEditPayment = (pay: any) => {
    setPaymentIdToEdit(pay.id);
    setPaymentProjectId(pay.projectId);
    setPaymentPartnerId(pay.partnerId);
    setPaymentAmount(Number(pay.amount).toString());
    const dateStr = new Date(pay.paymentDate).toISOString().split('T')[0];
    setPaymentDate(dateStr);
    setPaymentPeriodMonth(pay.applicableMonth ?? (new Date(pay.paymentDate).getMonth() + 1));
    setPaymentPeriodYear(pay.applicableYear ?? new Date(pay.paymentDate).getFullYear());
    setPaymentClientName(pay.clientName || '');
    setShowPaymentModal(true);
  };

  const performDeletePayment = async (id: string) => {
    setError('');
    try {
      const res = await fetch(`/api/projects/payments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete payment');
      loadPaymentsData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePayment = (id: string) => {
    triggerConfirm({
      title: 'Delete Payment Record',
      message: 'Are you sure you want to delete this payment? This is a soft-delete and will update calculations.',
      confirmText: 'Delete',
      type: 'danger',
      onConfirm: () => performDeletePayment(id),
    });
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
            <h1 className="text-3xl font-bold tracking-tight text-white">Projects & Payments</h1>
            <p className="text-slate-400 mt-1">Track projects contract values and client direct payments</p>
          </div>
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Upload className="mr-2 h-4 w-4 text-cyan-400" /> Import CSV
            </button>
            <button
              onClick={() => {
                resetProjectForm();
                setShowProjectModal(true);
              }}
              className="flex items-center px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Project
            </button>
            <button
              onClick={openNewPayment}
              disabled={projectsList.length === 0 || partnersList.filter(p => p.isActive).length === 0}
              className="flex items-center px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <DollarSign className="mr-2 h-4 w-4" /> Record Payment
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
          {/* Custom selector for Projects */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Project</label>
            <select
              value={filters.projectId}
              onChange={(e) => handleFilterChange({ ...filters, projectId: e.target.value, page: 1 })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[150px]"
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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

        {/* Filtered summaries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Contract Budget</p>
            <p className="text-2xl font-bold text-white mt-2">{formatCurrency(summary.totalProjectAmount)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Payments Received</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">{formatCurrency(summary.totalAmountReceived)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Outstanding Amount</p>
            <p className="text-2xl font-bold text-orange-400 mt-2">{formatCurrency(summary.outstandingAmount)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Payments Count</p>
            <p className="text-2xl font-bold text-cyan-400 mt-2">{summary.numberOfPayments}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Portfolio portfolio list */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-1 space-y-4 h-fit">
              <h3 className="text-lg font-bold text-white mb-2">Projects Portfolio</h3>
              <div className="space-y-3">
                {projectsList.length === 0 ? (
                  <p className="text-sm text-slate-400">No projects configured yet.</p>
                ) : (
                  projectsList.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2 relative"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-white truncate">{p.name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center space-x-1.5 ml-2">
                          <button
                            onClick={() => openEditProject(p)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                        <span className="text-xs text-slate-500 font-medium">Budget:</span>
                        <span className="text-sm font-bold text-cyan-400">{formatCurrency(p.totalAmount)}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-slate-500">Status:</span>
                        <span className={`font-semibold ${p.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {p.isActive ? 'Active' : 'Archived'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payments List */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 text-left font-semibold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-4">Period</th>
                      <th className="pb-3 px-4">Project</th>
                      <th className="pb-3 px-4">Client</th>
                      <th className="pb-3 px-4">Received By Partner</th>
                      <th className="pb-3 px-4 text-right">Amount</th>
                      <th className="pb-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No payments match your filter settings.
                        </td>
                      </tr>
                    ) : (
                      payments.map((pay: any) => {
                        const settled = isPeriodSettled(pay.applicableMonth, pay.applicableYear);
                        return (
                          <tr
                            key={pay.id}
                            className={`transition-colors border-l-2 ${
                              settled
                                ? 'bg-slate-950/20 opacity-70 border-emerald-500/30 text-slate-450 select-none'
                                : 'hover:bg-slate-800/10 border-transparent text-slate-350'
                            }`}
                          >
                            <td className="py-4 pr-4 font-mono text-xs">
                              {formatDate(pay.paymentDate)}
                            </td>
                            <td className="py-4 px-4 font-mono text-xs">
                              {pay.applicableMonth ? `${pay.applicableMonth.toString().padStart(2, '0')}/${pay.applicableYear}` : 'N/A'}
                            </td>
                            <td className={`py-4 px-4 font-semibold truncate max-w-[200px] ${settled ? 'text-slate-400 font-normal' : 'text-white'}`}>{pay.project.name}</td>
                            <td className="py-4 px-4 text-slate-300">{pay.clientName || 'N/A'}</td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center text-xs text-slate-300 bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-700">
                                <User className="h-3 w-3 mr-1 text-cyan-400" />
                                {pay.partner.name}
                              </span>
                            </td>
                            <td className={`py-4 px-4 text-right font-bold ${settled ? 'text-slate-400' : 'text-emerald-400'}`}>
                              {formatCurrency(pay.amount)}
                              {settled && <span className="text-emerald-500 text-[10px] ml-1">✓</span>}
                            </td>
                            <td className="py-4 pl-4 text-right">
                              {settled ? (
                                <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                                  Reconciled
                                </span>
                              ) : (
                                <div className="space-x-1.5 inline-block">
                                  <button
                                    onClick={() => openEditPayment(pay)}
                                    className="inline-block p-1 text-slate-400 hover:text-white"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayment(pay.id)}
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

              {/* Pagination */}
              <Pagination
                page={filters.page}
                totalPages={totalPages}
                totalItems={totalCount}
                limit={filters.limit}
                onPageChange={(page) => handleFilterChange({ ...filters, page })}
              />
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <CSVImportModal
            type="payments"
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              loadRoots();
              loadPaymentsData();
            }}
          />
        )}

        {/* Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {projectIdToEdit ? 'Edit Project Details' : 'Add New Project'}
              </h3>
              <form onSubmit={handleProjectSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., Client Website Redesign"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 h-20 resize-none"
                    placeholder="Details about project scope..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Total Contract Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={projectTotal}
                    onChange={(e) => setProjectTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="50000.00"
                  />
                </div>
                {projectIdToEdit && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="projectIsActive"
                      checked={projectIsActive}
                      onChange={(e) => setProjectIsActive(e.target.checked)}
                      className="rounded text-cyan-400 bg-slate-900 border-slate-700 focus:ring-cyan-500 h-4 w-4"
                    />
                    <label htmlFor="projectIsActive" className="ml-2 text-sm text-slate-300">
                      Project is Active
                    </label>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProjectModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Save Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {paymentIdToEdit ? 'Edit Payment Record' : 'Record Project Payment'}
              </h3>
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                  <select
                    value={paymentProjectId}
                    onChange={(e) => setPaymentProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    required
                    value={paymentClientName}
                    onChange={(e) => setPaymentClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., ACME Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Recipient Partner (Holds Company Funds)</label>
                  <select
                    value={paymentPartnerId}
                    onChange={(e) => setPaymentPartnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-955 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {partnersList.map((p) => (
                      <option key={p.id} value={p.id}>
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
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="10000.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Month</label>
                    <select
                      value={paymentPeriodMonth}
                      onChange={(e) => setPaymentPeriodMonth(parseInt(e.target.value, 10))}
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
                      value={paymentPeriodYear}
                      onChange={(e) => setPaymentPeriodYear(parseInt(e.target.value, 10))}
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
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {paymentIdToEdit ? 'Edit Payment Record' : 'Record Project Payment'}
              </h3>
              
              {error && (
                <div className="rounded-lg bg-red-950/40 border border-red-500/50 p-3 text-xs text-red-200 animate-pulse">
                  {error}
                </div>
              )}

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                  <select
                    value={paymentProjectId}
                    onChange={(e) => setPaymentProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Partner Receiving payment</label>
                  <select
                    value={paymentPartnerId}
                    onChange={(e) => setPaymentPartnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {partnersList.map((p) => (
                      <option key={p.id} value={p.id}>
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
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="50000.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={paymentClientName}
                    onChange={(e) => setPaymentClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., Acme Corp"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Month</label>
                    <select
                      value={paymentPeriodMonth}
                      onChange={(e) => setPaymentPeriodMonth(parseInt(e.target.value, 10))}
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
                      value={paymentPeriodYear}
                      onChange={(e) => setPaymentPeriodYear(parseInt(e.target.value, 10))}
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
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
      <ProjectsContent />
    </Suspense>
  );
}
