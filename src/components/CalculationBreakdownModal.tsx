import React from 'react';
import { X, Calculator, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface CalculationBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  data: {
    profitShare: number;
    credits: number;
    debits: number;
    salariesPaid: number;
    expensesPaid: number;
    totalCompanyMoneyReceived: number; // PPR_P + CDSR_P
    clientDirectSalaryReceived?: number;
    companyMoneyReceived?: number;
    netBalance: number;
  } | null;
}

export default function CalculationBreakdownModal({
  isOpen,
  onClose,
  partnerName,
  data,
}: CalculationBreakdownModalProps) {
  if (!isOpen || !data) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const formatCurrencySigned = (val: number, isAddition: boolean) => {
    const formatted = formatCurrency(Math.abs(val));
    if (val === 0) return `₹0.00`;
    return `${isAddition ? '+' : '-'}${formatted}`;
  };

  // Section 1: Earnings & Reimbursements (+)
  const earningsSubtotal = 
    Number(data.profitShare) + 
    Number(data.credits) + 
    Number(data.salariesPaid) + 
    Number(data.expensesPaid);

  // Section 2: Draws & Deductions (-)
  // note: totalCompanyMoneyReceived includes project payments + client direct salary.
  // debits are also subtracted from partner's receivable.
  const drawsSubtotal = 
    Number(data.debits) + 
    Number(data.totalCompanyMoneyReceived);

  const calculatedNet = earningsSubtotal - drawsSubtotal;
  const isReceivable = data.netBalance >= 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div 
        className="max-w-md w-full glass-card rounded-2xl border border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Calculator className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Calculation Breakdown</h3>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{partnerName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-750"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          
          {/* Section 1: Earnings (+) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              Earnings & Reimbursements (+)
            </h4>
            <div className="bg-slate-950/40 rounded-xl border border-slate-900/60 p-3 space-y-2 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-450">Profit Share</span>
                <span className="text-slate-200">{formatCurrency(data.profitShare)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Other Credits (Adjustments)</span>
                <span className="text-emerald-400 font-semibold">{formatCurrencySigned(data.credits, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Salaries Paid Personally</span>
                <span className="text-emerald-400 font-semibold">{formatCurrencySigned(data.salariesPaid, true)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Company Expenses Paid Personally</span>
                <span className="text-emerald-400 font-semibold">{formatCurrencySigned(data.expensesPaid, true)}</span>
              </div>
              <div className="border-t border-slate-900 pt-2 flex justify-between font-bold text-emerald-400">
                <span>Subtotal Earnings</span>
                <span>{formatCurrency(earningsSubtotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Draws (-) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5"></span>
              Draws & Deductions (-)
            </h4>
            <div className="bg-slate-950/40 rounded-xl border border-slate-900/60 p-3 space-y-2 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-450">Other Debits (Adjustments)</span>
                <span className="text-rose-400 font-semibold">{formatCurrencySigned(data.debits, false)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450">Company Money Received (Draws)</span>
                <span className="text-rose-400 font-semibold">{formatCurrencySigned(data.totalCompanyMoneyReceived, false)}</span>
              </div>
              <div className="border-t border-slate-900 pt-2 flex justify-between font-bold text-rose-450">
                <span>Subtotal Deductions</span>
                <span>{formatCurrency(drawsSubtotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Summary Equation */}
          <div className="pt-2 border-t border-slate-850 space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-950 border-slate-850 font-bold">
              <span className="flex items-center space-x-1.5 text-slate-300">
                {isReceivable ? (
                  <>
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                    <span>Owed to Partner</span>
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="h-4 w-4 text-rose-500" />
                    <span>Owed to Company</span>
                  </>
                )}
              </span>
              <span className={`text-sm font-extrabold ${isReceivable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(data.netBalance)}
              </span>
            </div>

            <div className="bg-[#1e293b]/20 border border-[#2e3e56]/40 rounded-lg p-2.5 text-slate-450 font-semibold text-[10px] text-center leading-normal">
              Equation: Earnings ({formatCurrency(earningsSubtotal)}) - Deductions ({formatCurrency(drawsSubtotal)}) = {formatCurrency(data.netBalance)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
