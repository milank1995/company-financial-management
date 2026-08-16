'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  UserCheck,
  Receipt,
  Scale,
  DollarSign,
  LogOut,
  Menu,
  X,
  Building2,
} from 'lucide-react';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Partners & Ownership', href: '/partners', icon: Users },
    { name: 'Projects & Payments', href: '/projects', icon: Briefcase },
    { name: 'Employees & Salaries', href: '/employees', icon: UserCheck },
    { name: 'Company Expenses', href: '/expenses', icon: Receipt },
    { name: 'Partner Adjustments', href: '/adjustments', icon: Scale },
    { name: 'Partner Settlement', href: '/settlement', icon: DollarSign },
  ];

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  return (
    <div className="min-h-screen flex bg-[#090b11]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 bg-[#0d121f] border-r border-[#1e293b]">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          {/* Logo & Company Name */}
          <div className="flex items-center px-4 mb-6 space-x-2">
            <Building2 className="h-8 w-8 text-cyan-400" />
            <span className="text-xl font-bold tracking-tight text-white">FinanceHub</span>
          </div>

          <div className="px-4 py-2 mb-4 mx-3 rounded-lg bg-[#162035] border border-[#233554]">
            <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">Company</p>
            <p className="text-sm font-semibold text-white truncate">{user?.companyName || 'Loading...'}</p>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 space-y-1">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-400 pl-2'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                    active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="flex-shrink-0 flex border-t border-[#1e293b] p-4 bg-[#0a0f1b]">
          <div className="flex items-center w-full">
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ml-2"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d121f] border-b border-[#1e293b] flex items-center justify-between px-4 z-40">
        <div className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-cyan-400" />
          <span className="text-lg font-bold text-white">FinanceHub</span>
        </div>
        <button
          onClick={toggleMobile}
          className="p-2 rounded-md text-slate-400 hover:text-white focus:outline-none"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={toggleMobile}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 w-64 bg-[#0d121f] border-r border-[#1e293b] z-50 transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full pt-5 pb-4">
          <div className="flex items-center justify-between px-4 mb-6">
            <div className="flex items-center space-x-2">
              <Building2 className="h-6 w-6 text-cyan-400" />
              <span className="text-lg font-bold text-white">FinanceHub</span>
            </div>
            <button onClick={toggleMobile} className="p-2 text-slate-400 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="px-4 py-2 mb-4 mx-3 rounded-lg bg-[#162035] border border-[#233554]">
            <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">Company</p>
            <p className="text-sm font-semibold text-white truncate">{user?.companyName || 'Loading...'}</p>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-400 pl-2'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex-shrink-0 border-t border-[#1e293b] p-4 bg-[#0a0f1b] flex items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ml-2"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <main className="flex-1 py-8 px-4 sm:px-6 md:px-8 mt-16 md:mt-0">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
