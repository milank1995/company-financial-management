'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SidebarLayout from '@/components/SidebarLayout';
import FinancialFilterBar from '@/components/FinancialFilterBar';
import Pagination from '@/components/Pagination';
import CSVImportModal from '@/components/CSVImportModal';
import { useAuth } from '@/context/AuthContext';
import { exportToCSV } from '@/lib/csvExport';
import { Plus, Edit2, Trash2, Calendar, User, DollarSign, Building, Users, Handshake, Upload } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  isActive: boolean;
}

interface Partner {
  id: string;
  name: string;
  isActive?: boolean;
}

interface Salary {
  id: string;
  employeeId: string;
  amount: string | number;
  paymentDate: string;
  paymentSource: 'COMPANY' | 'PARTNER' | 'CLIENT_DIRECT';
  partnerId: string | null;
  clientName: string | null;
  receivedByPartnerId: string | null;
  employee: Employee;
  partner: Partner | null;
  receivedByPartner: Partner | null;
}

function EmployeesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Root Data Lists
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [partnersList, setPartnersList] = useState<Partner[]>([]);
  
  // Table Data & Paginated aggregates
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<any>({
    totalSalaryExpense: 0,
    paidByCompany: 0,
    paidByPartners: 0,
    paidDirectlyByClients: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);

  // Initial Filter State parsed from URL
  const [filters, setFilters] = useState({
    periodType: (searchParams.get('periodType') || 'monthly') as 'all' | 'monthly' | 'yearly' | 'custom',
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear(),
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : new Date().getMonth() + 1,
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    partnerId: searchParams.get('partnerId') || '',
    employeeId: searchParams.get('employeeId') || '',
    paymentSource: searchParams.get('paymentSource') || '',
    receivedByPartnerId: searchParams.get('receivedByPartnerId') || '',
    search: searchParams.get('search') || '',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    limit: 10,
  });

  // Employee Modal State
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeIdToEdit, setEmployeeIdToEdit] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeRole, setEmployeeRole] = useState('');
  const [employeeIsActive, setEmployeeIsActive] = useState(true);

  // Salary Modal State
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryIdToEdit, setSalaryIdToEdit] = useState<string | null>(null);
  const [salaryEmployeeId, setSalaryEmployeeId] = useState('');
  const [salaryPartnerId, setSalaryPartnerId] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryDate, setSalaryDate] = useState('');
  const [salaryPeriodMonth, setSalaryPeriodMonth] = useState(new Date().getMonth() + 1);
  const [salaryPeriodYear, setSalaryPeriodYear] = useState(new Date().getFullYear());
  
  // Conditional Salary payment source states
  const [salaryPaymentSource, setSalaryPaymentSource] = useState<'COMPANY' | 'PARTNER' | 'CLIENT_DIRECT'>('COMPANY');
  const [salaryClientName, setSalaryClientName] = useState('');
  const [salaryReceivedByPartnerId, setSalaryReceivedByPartnerId] = useState('');

  // Update URL parameters
  const updateURL = (updatedFilters: any) => {
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });
    router.push(`/employees?${params.toString()}`);
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
      employeeId: searchParams.get('employeeId') || '',
      paymentSource: searchParams.get('paymentSource') || '',
      receivedByPartnerId: searchParams.get('receivedByPartnerId') || '',
      search: searchParams.get('search') || '',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
      limit: 10,
    });
  }, [searchParams]);

  // Load root entities (Partners, Employees) once
  const loadRoots = async () => {
    try {
      const [resEmp, resPart] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/partners'),
      ]);
      if (resEmp.ok && resPart.ok) {
        setEmployeesList(await resEmp.json());
        setPartnersList(await resPart.json());
      }
    } catch (err) {
      console.error('Failed to load roots:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadRoots();
    }
  }, [user]);

  // Load Salaries based on active filters
  const loadSalariesData = async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });

    try {
      const resSal = await fetch(`/api/employees/salaries?${params.toString()}`);
      if (!resSal.ok) throw new Error('Failed to load salary details');
      
      const data = await resSal.json();
      setSalaries(data.items);
      setTotalCount(data.total);
      setTotalPages(data.totalPages);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSalariesData();
    }
  }, [user, filters]);

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
      employeeId: '',
      paymentSource: '',
      receivedByPartnerId: '',
      search: '',
      page: 1,
      limit: 10,
    };
    updateURL(cleared);
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Employee',
      'Amount',
      'Payment Source',
      'Paid By',
      'Client',
      'Received By Partner',
    ];

    const rows = salaries.map((sal) => [
      formatDate(sal.paymentDate),
      sal.employee.name,
      sal.amount,
      sal.paymentSource,
      sal.partner?.name || 'N/A',
      sal.clientName || 'N/A',
      sal.receivedByPartner?.name || 'N/A',
    ]);

    exportToCSV(`salaries-export-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  // Employee Submit
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = employeeIdToEdit ? `/api/employees/${employeeIdToEdit}` : '/api/employees';
    const method = employeeIdToEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: employeeName,
          email: employeeEmail,
          role: employeeRole,
          isActive: employeeIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save employee');

      setShowEmployeeModal(false);
      resetEmployeeForm();
      loadRoots();
      loadSalariesData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeIdToEdit(null);
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeeRole('');
    setEmployeeIsActive(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEmployeeIdToEdit(emp.id);
    setEmployeeName(emp.name);
    setEmployeeEmail(emp.email || '');
    setEmployeeRole(emp.role || '');
    setEmployeeIsActive(emp.isActive);
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    setError('');
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete employee');
      loadRoots();
      loadSalariesData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Salary Submit
  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      employeeId: salaryEmployeeId,
      amount: parseFloat(salaryAmount),
      paymentDate: salaryDate,
      paymentSource: salaryPaymentSource,
      partnerId: salaryPaymentSource === 'PARTNER' ? salaryPartnerId : null,
      clientName: salaryPaymentSource === 'CLIENT_DIRECT' ? salaryClientName : null,
      receivedByPartnerId:
        salaryPaymentSource === 'CLIENT_DIRECT' && salaryReceivedByPartnerId
          ? salaryReceivedByPartnerId
          : null,
      applicableMonth: salaryPeriodMonth,
      applicableYear: salaryPeriodYear,
    };

    try {
      const res = await fetch(
        salaryIdToEdit ? `/api/employees/salaries/${salaryIdToEdit}` : '/api/employees/salaries',
        {
          method: salaryIdToEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save salary record');

      setShowSalaryModal(false);
      resetSalaryForm();
      loadSalariesData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetSalaryForm = () => {
    setSalaryIdToEdit(null);
    setSalaryEmployeeId('');
    setSalaryPartnerId('');
    setSalaryAmount('');
    setSalaryDate('');
    setSalaryPeriodMonth(new Date().getMonth() + 1);
    setSalaryPeriodYear(new Date().getFullYear());
    setSalaryPaymentSource('COMPANY');
    setSalaryClientName('');
    setSalaryReceivedByPartnerId('');
  };

  const openNewSalary = () => {
    resetSalaryForm();
    if (employeesList.length > 0) setSalaryEmployeeId(employeesList[0].id);
    const activeParts = partnersList.filter(p => p.isActive);
    if (activeParts.length > 0) {
      setSalaryPartnerId(activeParts[0].id);
      setSalaryReceivedByPartnerId(activeParts[0].id);
    }
    setShowSalaryModal(true);
  };

  const openEditSalary = (sal: any) => {
    setSalaryIdToEdit(sal.id);
    setSalaryEmployeeId(sal.employeeId);
    setSalaryAmount(Number(sal.amount).toString());
    const dateStr = new Date(sal.paymentDate).toISOString().split('T')[0];
    setSalaryDate(dateStr);
    setSalaryPeriodMonth(sal.applicableMonth ?? (new Date(sal.paymentDate).getMonth() + 1));
    setSalaryPeriodYear(sal.applicableYear ?? new Date(sal.paymentDate).getFullYear());
    
    setSalaryPaymentSource(sal.paymentSource);
    const activeParts = partnersList.filter(p => p.isActive);
    const defaultPartner = activeParts.length > 0 ? activeParts[0].id : '';
    setSalaryPartnerId(sal.partnerId || defaultPartner);
    setSalaryClientName(sal.clientName || '');
    setSalaryReceivedByPartnerId(sal.receivedByPartnerId || defaultPartner);
    setShowSalaryModal(true);
  };

  const handleDeleteSalary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this salary payment? This is a soft-delete and will update aggregates instantly.')) return;
    setError('');
    try {
      const res = await fetch(`/api/employees/salaries/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete salary payment');
      loadSalariesData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatCurrency = (val: any) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
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
            <h1 className="text-3xl font-bold tracking-tight text-white">Employees & Salaries</h1>
            <p className="text-slate-400 mt-1">Manage staff and query payment breakdowns across sources</p>
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
                resetEmployeeForm();
                setShowEmployeeModal(true);
              }}
              className="flex items-center px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </button>
            <button
              onClick={openNewSalary}
              disabled={employeesList.length === 0}
              className="flex items-center px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              <DollarSign className="mr-2 h-4 w-4" /> Pay Salary
            </button>
          </div>
        </div>

        {/* Reusable Query Filter Bar */}
        <FinancialFilterBar
          partners={partnersList}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          onExportCSV={handleExportCSV}
          totalCount={totalCount}
        >
          {/* Custom Selectors for Salaries */}
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Employee</label>
            <select
              value={filters.employeeId}
              onChange={(e) => handleFilterChange({ ...filters, employeeId: e.target.value, page: 1 })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[150px]"
            >
              <option value="">All Employees</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Source</label>
            <select
              value={filters.paymentSource}
              onChange={(e) => handleFilterChange({ ...filters, paymentSource: e.target.value, page: 1 })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[150px]"
            >
              <option value="">All Sources</option>
              <option value="COMPANY">COMPANY</option>
              <option value="PARTNER">PARTNER</option>
              <option value="CLIENT_DIRECT">CLIENT_DIRECT</option>
            </select>
          </div>
        </FinancialFilterBar>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Dynamic Aggregated Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Salary Expense</p>
            <p className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(summary.totalSalaryExpense)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paid by Company</p>
            <p className="text-2xl font-bold text-white mt-2">{formatCurrency(summary.paidByCompany)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paid by Partners</p>
            <p className="text-2xl font-bold text-cyan-400 mt-2">{formatCurrency(summary.paidByPartners)}</p>
          </div>
          <div className="glass-card p-5 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Paid by Clients</p>
            <p className="text-2xl font-bold text-orange-400 mt-2">{formatCurrency(summary.paidDirectlyByClients)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Staff list side panel */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-1 space-y-4 h-fit">
              <h3 className="text-lg font-bold text-white mb-2">Staff Members</h3>
              <div className="space-y-3">
                {employeesList.length === 0 ? (
                  <p className="text-sm text-slate-400">No staff configured yet.</p>
                ) : (
                  employeesList.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex justify-between items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate text-sm">{e.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{e.role || 'No role'}</p>
                      </div>
                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => openEditEmployee(e)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(e.id)}
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Salaries Table */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 text-left font-semibold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 px-4">Period</th>
                      <th className="pb-3 px-4">Employee</th>
                      <th className="pb-3 px-4">Source</th>
                      <th className="pb-3 px-4">Paid By</th>
                      <th className="pb-3 px-4">Client</th>
                      <th className="pb-3 px-4">Received By Partner</th>
                      <th className="pb-3 px-4 text-right">Amount</th>
                      <th className="pb-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {salaries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No salary payments match your filter settings.
                        </td>
                      </tr>
                    ) : (
                      salaries.map((sal: any) => (
                        <tr key={sal.id} className="text-slate-300 hover:bg-slate-800/10">
                          <td className="py-4 pr-4 font-mono text-xs text-slate-400">
                            {formatDate(sal.paymentDate)}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-300">
                            {sal.applicableMonth ? `${sal.applicableMonth.toString().padStart(2, '0')}/${sal.applicableYear}` : 'N/A'}
                          </td>
                          <td className="py-4 px-4 font-semibold text-white">{sal.employee.name}</td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              sal.paymentSource === 'COMPANY'
                                ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-400'
                                : sal.paymentSource === 'PARTNER'
                                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400'
                                : 'bg-orange-950/20 border-orange-800/40 text-orange-400'
                            }`}>
                              {sal.paymentSource}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-300">{sal.partner?.name || '-'}</td>
                          <td className="py-4 px-4 text-slate-300">{sal.clientName || '-'}</td>
                          <td className="py-4 px-4 text-slate-300">{sal.receivedByPartner?.name || '-'}</td>
                          <td className="py-4 px-4 text-right font-bold text-rose-400">
                            {formatCurrency(sal.amount)}
                          </td>
                          <td className="py-4 pl-4 text-right space-x-1.5">
                            <button
                              onClick={() => openEditSalary(sal)}
                              className="inline-block p-1 text-slate-400 hover:text-white"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSalary(sal.id)}
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
          </div>
        )}

        {/* CSV Import Modal */}
        {showImportModal && (
          <CSVImportModal
            type="salaries"
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              loadRoots();
              loadSalariesData();
            }}
          />
        )}

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {employeeIdToEdit ? 'Edit Employee Details' : 'Add New Staff Member'}
              </h3>
              <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="E.g., Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="jane@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Job Role</label>
                  <input
                    type="text"
                    value={employeeRole}
                    onChange={(e) => setEmployeeRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Software Engineer"
                  />
                </div>
                {employeeIdToEdit && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="employeeIsActive"
                      checked={employeeIsActive}
                      onChange={(e) => setEmployeeIsActive(e.target.checked)}
                      className="rounded text-cyan-400 bg-slate-900 border-slate-700 focus:ring-cyan-500 h-4 w-4"
                    />
                    <label htmlFor="projectIsActive" className="ml-2 text-sm text-slate-300">
                      Employee is Active
                    </label>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmployeeModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Save Details
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Salary Modal */}
        {showSalaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {salaryIdToEdit ? 'Edit Salary Payout' : 'Record Salary Payout'}
              </h3>
              <form onSubmit={handleSalarySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Employee</label>
                  <select
                    value={salaryEmployeeId}
                    onChange={(e) => setSalaryEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {employeesList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Source</label>
                  <select
                    value={salaryPaymentSource}
                    onChange={(e) => setSalaryPaymentSource(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="COMPANY">COMPANY (Paid directly by the company)</option>
                    <option value="PARTNER">PARTNER (Paid personally by partner)</option>
                    <option value="CLIENT_DIRECT">CLIENT_DIRECT (Direct client paid to employee/partner)</option>
                  </select>
                </div>

                {salaryPaymentSource === 'PARTNER' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Paid By (Partner)</label>
                    <select
                      value={salaryPartnerId}
                      onChange={(e) => setSalaryPartnerId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {partnersList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {salaryPaymentSource === 'CLIENT_DIRECT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Client Name</label>
                      <input
                        type="text"
                        required
                        value={salaryClientName}
                        onChange={(e) => setSalaryClientName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Client Company Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Received By Partner (Optional)
                      </label>
                      <select
                        value={salaryReceivedByPartnerId}
                        onChange={(e) => setSalaryReceivedByPartnerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">Directly to Employee (No Partner Account)</option>
                        {partnersList.map((p) => (
                          <option key={p.id} value={p.id}>
                            Received into account of: {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Salary Expense Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="3500.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={salaryDate}
                    onChange={(e) => setSalaryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Accounting Month</label>
                    <select
                      value={salaryPeriodMonth}
                      onChange={(e) => setSalaryPeriodMonth(parseInt(e.target.value, 10))}
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
                      value={salaryPeriodYear}
                      onChange={(e) => setSalaryPeriodYear(parseInt(e.target.value, 10))}
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
                    onClick={() => setShowSalaryModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400"
                  >
                    Save Salary
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
      <EmployeesContent />
    </Suspense>
  );
}
