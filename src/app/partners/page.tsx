'use client';

import React, { useEffect, useState } from 'react';
import SidebarLayout from '@/components/SidebarLayout';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit2, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
}

interface PartnerOwnership {
  id: string;
  partnerId: string;
  percentage: string | number;
  partner: Partner;
}

interface OwnershipSetup {
  id: string;
  effectiveDate: string;
  partnerOwnerships: PartnerOwnership[];
}

export default function PartnersPage() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [setups, setSetups] = useState<OwnershipSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Partner Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerIdToEdit, setPartnerIdToEdit] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerIsActive, setPartnerIsActive] = useState(true);

  // Ownership Setup Form State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupIdToEdit, setSetupIdToEdit] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [percentages, setPercentages] = useState<Record<string, string>>({}); // partnerId -> percentage (string input)

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/partners');
      if (!res.ok) throw new Error('Failed to fetch partners');
      const data = await res.json();
      setPartners(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchSetups = async () => {
    try {
      const res = await fetch('/api/partners/ownership-setup');
      if (!res.ok) throw new Error('Failed to fetch ownership setups');
      const data = await res.json();
      setSetups(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchPartners(), fetchSetups()]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  // Handle Partner Submit
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = partnerIdToEdit ? `/api/partners/${partnerIdToEdit}` : '/api/partners';
    const method = partnerIdToEdit ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerName,
          email: partnerEmail,
          isActive: partnerIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save partner');

      setShowPartnerModal(false);
      resetPartnerForm();
      fetchPartners();
      fetchSetups(); // Refresh setups since partner details might have changed
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetPartnerForm = () => {
    setPartnerIdToEdit(null);
    setPartnerName('');
    setPartnerEmail('');
    setPartnerIsActive(true);
  };

  const openEditPartner = (p: Partner) => {
    setPartnerIdToEdit(p.id);
    setPartnerName(p.name);
    setPartnerEmail(p.email || '');
    setPartnerIsActive(p.isActive);
    setShowPartnerModal(true);
  };

  const handleDeletePartner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this partner?')) return;
    setError('');
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete partner');
      fetchPartners();
      fetchSetups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle Setup Submit
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const ownershipList = Object.entries(percentages).map(([partnerId, percentage]) => ({
      partnerId,
      percentage: parseFloat(percentage) || 0,
    }));

    const sum = ownershipList.reduce((acc, curr) => acc + curr.percentage, 0);
    if (Math.abs(sum - 100.0) > 0.01) {
      setError(`Percentages must sum to exactly 100%. Current total: ${sum}%`);
      return;
    }

    const endpoint = setupIdToEdit ? `/api/partners/ownership-setup/${setupIdToEdit}` : '/api/partners/ownership-setup';
    const method = setupIdToEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate,
          ownerships: ownershipList,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save ownership setup');

      setShowSetupModal(false);
      resetSetupForm();
      fetchSetups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetSetupForm = () => {
    setSetupIdToEdit(null);
    setEffectiveDate('');
    setPercentages({});
  };

  const openNewSetup = () => {
    resetSetupForm();
    // Pre-populate percentages to 0
    const initialPercentages: Record<string, string> = {};
    partners.forEach((p) => {
      if (p.isActive) {
        initialPercentages[p.id] = '0';
      }
    });
    setPercentages(initialPercentages);
    setShowSetupModal(true);
  };

  const openEditSetup = (setup: OwnershipSetup) => {
    setSetupIdToEdit(setup.id);
    // Format date string to YYYY-MM-DD
    const date = new Date(setup.effectiveDate);
    const dateString = date.toISOString().split('T')[0];
    setEffectiveDate(dateString);

    const initialPercentages: Record<string, string> = {};
    // Pre-populate with existing values
    partners.forEach((p) => {
      const match = setup.partnerOwnerships.find((po) => po.partnerId === p.id);
      initialPercentages[p.id] = match ? (Number(match.percentage) * 100).toFixed(2) : '0';
    });
    setPercentages(initialPercentages);
    setShowSetupModal(true);
  };

  const handleDeleteSetup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ownership setup?')) return;
    setError('');
    try {
      const res = await fetch(`/api/partners/ownership-setup/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete setup');
      fetchSetups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const sumPercentages = () => {
    return Object.values(percentages).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  };

  const formatPercent = (val: any) => {
    return (Number(val) * 100).toFixed(2) + '%';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
            <h1 className="text-3xl font-bold tracking-tight text-white">Partners & Ownership</h1>
            <p className="text-slate-400 mt-1">Configure active partners and historical equity splits</p>
          </div>
          <button
            onClick={() => {
              resetPartnerForm();
              setShowPartnerModal(true);
            }}
            className="flex items-center px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Partner
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Partners List */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-1 space-y-4 h-fit">
              <h3 className="text-lg font-bold text-white mb-2">Company Partners</h3>
              <div className="space-y-3">
                {partners.length === 0 ? (
                  <p className="text-sm text-slate-400">No partners configured yet.</p>
                ) : (
                  partners.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 truncate">{p.email || 'No email'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${
                            p.isActive ? 'bg-emerald-400' : 'bg-slate-600'
                          }`}
                        />
                        <button
                          onClick={() => openEditPartner(p)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePartner(p.id)}
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ownership Setup List */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Ownership Percentage History</h3>
                <button
                  onClick={openNewSetup}
                  disabled={partners.filter((p) => p.isActive).length === 0}
                  className="flex items-center px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> New Setup
                </button>
              </div>

              <div className="space-y-6">
                {setups.length === 0 ? (
                  <p className="text-sm text-slate-400">No ownership setups created yet.</p>
                ) : (
                  setups.map((setup) => (
                    <div
                      key={setup.id}
                      className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/80 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <p className="text-xs text-cyan-400 font-semibold tracking-wide uppercase">
                            Effective Date
                          </p>
                          <p className="text-sm font-bold text-white mt-1">
                            {formatDate(setup.effectiveDate)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditSetup(setup)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSetup(setup.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {setup.partnerOwnerships.map((po) => (
                          <div
                            key={po.id}
                            className="p-3 bg-[#111827]/40 rounded-xl border border-slate-800"
                          >
                            <p className="text-xs text-slate-400 truncate">{po.partner.name}</p>
                            <p className="text-lg font-bold text-cyan-400 mt-1">
                              {formatPercent(po.percentage)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Partner Form Modal */}
        {showPartnerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {partnerIdToEdit ? 'Edit Partner' : 'Add New Partner'}
              </h3>
              <form onSubmit={handlePartnerSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Partner Name</label>
                  <input
                    type="text"
                    required
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Partner Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 placeholder-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="partner@example.com"
                  />
                </div>
                {partnerIdToEdit && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={partnerIsActive}
                      onChange={(e) => setPartnerIsActive(e.target.checked)}
                      className="rounded text-cyan-400 bg-slate-900 border-slate-700 focus:ring-cyan-500 h-4 w-4"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm text-slate-300">
                      Partner is Active
                    </label>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPartnerModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
                  >
                    Save Partner
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ownership Setup Modal */}
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="max-w-md w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xl font-bold text-white">
                {setupIdToEdit ? 'Edit Ownership Setup' : 'Create Ownership Setup'}
              </h3>
              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Effective Date</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-900 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-300">Partner Splits (%)</p>
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    {partners
                      .filter((p) => p.isActive || setupIdToEdit)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between space-x-4">
                          <span className="text-sm text-slate-300 truncate flex-1">{p.name}</span>
                          <div className="relative rounded-md shadow-sm w-32">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              required
                              value={percentages[p.id] || '0'}
                              onChange={(e) =>
                                setPercentages({ ...percentages, [p.id]: e.target.value })
                              }
                              className="w-full pr-8 pl-3 py-1.5 border border-slate-700 bg-slate-900 text-right rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-slate-400 text-sm">%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Validation Indicator */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-sm text-slate-300">Total Ownership Sum:</span>
                  <div className="flex items-center space-x-1.5 font-bold">
                    <span>{sumPercentages()}%</span>
                    {Math.abs(sumPercentages() - 100) < 0.01 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-rose-500" />
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSetupModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Math.abs(sumPercentages() - 100) > 0.01}
                    className="px-4 py-2 bg-cyan-500 text-black text-sm font-semibold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Setup
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
