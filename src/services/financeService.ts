import { prisma } from '../lib/prisma';
import { Prisma, SalaryPaymentSource, PartnerAdjustmentType } from '@prisma/client';

export interface PartnerMonthlySettlement {
  partnerId: string;
  partnerName: string;
  ownershipPercentage: number; // 0 to 100
  profitShare: number;
  companyMoneyReceived: number;      // Project payments received (PPR_P)
  clientDirectSalaryReceived: number; // Client direct salaries received by partner (CDSR_P)
  totalCompanyMoneyReceived: number; // PPR_P + CDSR_P (TCMR_P)
  salariesPaid: number;              // Salaries paid personally (ESP_P)
  expensesPaid: number;              // Expenses paid personally (CEP_P)
  credits: number;                   // Adjustments > 0
  debits: number;                    // Adjustments < 0 (absolute)
  netAdjustment: number;             // Credits - Debits
  netBalance: number;                // ProfitShare + SalariesPaid + ExpensesPaid + NetAdjustment - TotalCompanyMoneyReceived
  settlementType: 'RECEIVABLE' | 'PAYABLE';
}

export interface MonthlyFinanceReport {
  year: number;
  month: number;
  totalIncome: number;
  totalSalaries: number; // Total Salary Expense
  totalExpenses: number;
  netProfit: number;
  paidByCompany: number;
  paidByPartners: number;
  paidDirectlyByClients: number;
  partnerSettlements: PartnerMonthlySettlement[];
  expensesByCategory: { category: string; amount: number }[];
}

export interface MultiMonthFinanceReport {
  periods: { year: number; month: number }[];
  totalIncome: number;
  totalSalaries: number;
  totalExpenses: number;
  netProfit: number;
  paidByCompany: number;
  paidByPartners: number;
  paidDirectlyByClients: number;
  partnerSettlements: PartnerMonthlySettlement[];
  expensesByCategory: { category: string; amount: number }[];
  monthlyBreakdown: {
    year: number;
    month: number;
    totalIncome: number;
    totalSalaries: number;
    totalExpenses: number;
    netProfit: number;
    paidByCompany: number;
    paidByPartners: number;
    paidDirectlyByClients: number;
    partnerSettlements: PartnerMonthlySettlement[];
  }[];
}

export interface YearlyFinanceReport {
  year: number;
  totalIncome: number;
  totalSalaries: number; // Total Salary Expense
  totalExpenses: number;
  netProfit: number;
  paidByCompany: number;
  paidByPartners: number;
  paidDirectlyByClients: number;
  monthlyBreakdown: {
    month: number;
    totalIncome: number;
    totalSalaries: number;
    totalExpenses: number;
    netProfit: number;
    paidByCompany: number;
    paidByPartners: number;
    paidDirectlyByClients: number;
    partnerSettlements: PartnerMonthlySettlement[];
  }[];
  partnerSettlements: {
    partnerId: string;
    partnerName: string;
    profitShare: number;
    companyMoneyReceived: number;
    clientDirectSalaryReceived: number;
    totalCompanyMoneyReceived: number;
    salariesPaid: number;
    expensesPaid: number;
    credits: number;
    debits: number;
    netAdjustment: number;
    netBalance: number;
    settlementType: 'RECEIVABLE' | 'PAYABLE';
  }[];
  expensesByCategory: { category: string; amount: number }[];
}

export interface PreFetchedFinanceData {
  partners: any[];
  setups: any[];
  payments: any[];
  salaries: any[];
  expenses: any[];
  adjustments: any[];
}

export function resolveOwnershipPercentagesInMemory(setups: any[], date: Date) {
  const latestSetup = setups.find((s) => new Date(s.effectiveDate) <= date);
  const percentages: Record<string, number> = {};
  
  if (!latestSetup) {
    return { percentages, setupId: null };
  }

  latestSetup.partnerOwnerships.forEach((po: any) => {
    percentages[po.partnerId] = toNumber(po.percentage);
  });

  return { percentages, setupId: latestSetup.id };
}

/**
 * Gets UTC date boundaries for a given month/year.
 */
export function getMonthBoundaries(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

/**
 * Helper to convert Prisma Decimal to number safely.
 */
export function toNumber(decimal: Prisma.Decimal | number | null | undefined): number {
  if (decimal === null || decimal === undefined) return 0;
  if (typeof decimal === 'number') return decimal;
  return decimal.toNumber();
}

/**
 * Validates whether an OwnershipSetup's percentages sum to exactly 1.0000 (100%).
 */
export async function validateOwnershipSetup(setupId: string): Promise<boolean> {
  const ownerships = await prisma.partnerOwnership.findMany({
    where: { setupId },
  });
  const sum = ownerships.reduce((acc, curr) => acc + toNumber(curr.percentage), 0);
  return Math.abs(sum - 1.0) < 0.00001;
}

/**
 * Resolves the ownership setup active for a given start date.
 */
export async function resolveOwnershipPercentages(companyId: string, date: Date) {
  const latestSetup = await prisma.ownershipSetup.findFirst({
    where: {
      companyId,
      effectiveDate: {
        lte: date,
      },
    },
    orderBy: {
      effectiveDate: 'desc',
    },
    include: {
      partnerOwnerships: {
        include: {
          partner: true,
        },
      },
    },
  });

  const percentages: Record<string, number> = {};
  
  if (!latestSetup) {
    return { percentages, setupId: null };
  }

  latestSetup.partnerOwnerships.forEach((po) => {
    percentages[po.partnerId] = toNumber(po.percentage);
  });

  return { percentages, setupId: latestSetup.id };
}

/**
 * Calculates financial aggregates and partner settlements for a single month.
 */
export async function getMonthlyFinanceReport(
  companyId: string,
  year: number,
  month: number,
  partnerId?: string,
  preFetchedData?: PreFetchedFinanceData
): Promise<MonthlyFinanceReport> {
  const { start, end } = getMonthBoundaries(year, month);

  // Fetch partners
  const partners = preFetchedData
    ? preFetchedData.partners
    : await prisma.partner.findMany({
        where: { companyId },
      });

  // Fetch transactions
  const payments = preFetchedData
    ? preFetchedData.payments.filter((p) => p.applicableYear === year && p.applicableMonth === month)
    : await prisma.projectPayment.findMany({
        where: {
          companyId,
          applicableYear: year,
          applicableMonth: month,
          deletedAt: null,
        },
      });

  const salaries = preFetchedData
    ? preFetchedData.salaries.filter((s) => s.applicableYear === year && s.applicableMonth === month)
    : await prisma.employeeSalary.findMany({
        where: {
          companyId,
          applicableYear: year,
          applicableMonth: month,
          deletedAt: null,
        },
      });

  const expenses = preFetchedData
    ? preFetchedData.expenses.filter((e) => e.applicableYear === year && e.applicableMonth === month)
    : await prisma.companyExpense.findMany({
        where: {
          companyId,
          applicableYear: year,
          applicableMonth: month,
          deletedAt: null,
        },
      });

  const adjustments = preFetchedData
    ? preFetchedData.adjustments.filter((a) => a.applicableYear === year && a.applicableMonth === month)
    : await prisma.partnerAdjustment.findMany({
        where: {
          companyId,
          applicableYear: year,
          applicableMonth: month,
          deletedAt: null,
        },
      });

  // Calculate aggregates
  const totalIncome = payments.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const totalSalaries = salaries.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  const netProfit = totalIncome - totalSalaries - totalExpenses;

  // Breakdown of salary payments by source
  const paidByCompany = salaries
    .filter((s) => s.paymentSource === SalaryPaymentSource.COMPANY)
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  
  const paidByPartners = salaries
    .filter((s) => s.paymentSource === SalaryPaymentSource.PARTNER)
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
  
  const paidDirectlyByClients = salaries
    .filter((s) => s.paymentSource === SalaryPaymentSource.CLIENT_DIRECT)
    .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

  // Resolve ownership active at the start of the month
  const { percentages } = preFetchedData
    ? resolveOwnershipPercentagesInMemory(preFetchedData.setups, start)
    : await resolveOwnershipPercentages(companyId, start);

  // Partner settlements
  const partnerSettlements: PartnerMonthlySettlement[] = partners.map((partner) => {
    const ownershipPerc = percentages[partner.id] || 0;
    const profitShare = netProfit * ownershipPerc;

    // 1. Company Money Received (from Project payments - PPR_P)
    const companyMoneyReceived = payments
      .filter((p) => p.partnerId === partner.id)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    // 2. Client Direct Salary Received by partner (CDSR_P)
    const clientDirectSalaryReceived = salaries
      .filter((s) => s.paymentSource === SalaryPaymentSource.CLIENT_DIRECT && s.receivedByPartnerId === partner.id)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    // 3. Total Company Money Received (TCMR_P = PPR_P + CDSR_P)
    const totalCompanyMoneyReceived = companyMoneyReceived + clientDirectSalaryReceived;

    // 4. Salaries paid by partner personally (ESP_P) - source must be PARTNER
    const salariesPaid = salaries
      .filter((s) => s.paymentSource === SalaryPaymentSource.PARTNER && s.partnerId === partner.id)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    // 5. Expenses paid by partner personally (CEP_P)
    const expensesPaid = expenses
      .filter((e) => e.partnerId === partner.id)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    // 6. Adjustments
    const partnerAdjs = adjustments.filter((a) => a.partnerId === partner.id);
    const credits = partnerAdjs
      .filter((a) => a.type === PartnerAdjustmentType.CREDIT || a.type === PartnerAdjustmentType.LOAN || toNumber(a.amount) > 0)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const debits = partnerAdjs
      .filter((a) => a.type === PartnerAdjustmentType.DEBIT || a.type === PartnerAdjustmentType.WITHDRAWAL || toNumber(a.amount) < 0)
      .reduce((acc, curr) => acc + Math.abs(toNumber(curr.amount)), 0);

    const netAdjustment = credits - debits;
    const netBalance = profitShare + salariesPaid + expensesPaid + netAdjustment - totalCompanyMoneyReceived;

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      ownershipPercentage: ownershipPerc * 100,
      profitShare,
      companyMoneyReceived,
      clientDirectSalaryReceived,
      totalCompanyMoneyReceived,
      salariesPaid,
      expensesPaid,
      credits,
      debits,
      netAdjustment,
      netBalance,
      settlementType: netBalance >= 0 ? 'RECEIVABLE' : 'PAYABLE',
    };
  });

  // Group expenses by category (filter by partner if provided)
  const expenseCategorySums: Record<string, number> = {};
  expenses
    .filter((e) => !partnerId || e.partnerId === partnerId)
    .forEach((e) => {
      const cat = e.category || 'Other';
      expenseCategorySums[cat] = (expenseCategorySums[cat] || 0) + toNumber(e.amount);
    });
  const expensesByCategory = Object.entries(expenseCategorySums)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    month,
    totalIncome,
    totalSalaries,
    totalExpenses,
    netProfit,
    paidByCompany,
    paidByPartners,
    paidDirectlyByClients,
    partnerSettlements,
    expensesByCategory,
  };
}

/**
 * Calculates yearly report as aggregation of monthly values.
 */
export async function getYearlyFinanceReport(
  companyId: string,
  year: number,
  partnerId?: string
): Promise<YearlyFinanceReport> {
  // Pre-fetch all data for the entire year in parallel
  const [partners, setups, payments, salaries, expenses, adjustments] = await Promise.all([
    prisma.partner.findMany({
      where: { companyId },
    }),
    prisma.ownershipSetup.findMany({
      where: { companyId },
      orderBy: { effectiveDate: 'desc' },
      include: {
        partnerOwnerships: {
          include: {
            partner: true,
          },
        },
      },
    }),
    prisma.projectPayment.findMany({
      where: {
        companyId,
        applicableYear: year,
        deletedAt: null,
      },
    }),
    prisma.employeeSalary.findMany({
      where: {
        companyId,
        applicableYear: year,
        deletedAt: null,
      },
    }),
    prisma.companyExpense.findMany({
      where: {
        companyId,
        applicableYear: year,
        deletedAt: null,
      },
    }),
    prisma.partnerAdjustment.findMany({
      where: {
        companyId,
        applicableYear: year,
        deletedAt: null,
      },
    }),
  ]);

  const preFetchedData: PreFetchedFinanceData = {
    partners,
    setups,
    payments,
    salaries,
    expenses,
    adjustments,
  };

  const monthlyReports: MonthlyFinanceReport[] = [];

  for (let m = 1; m <= 12; m++) {
    const report = await getMonthlyFinanceReport(companyId, year, m, partnerId, preFetchedData);
    monthlyReports.push(report);
  }

  // Sum aggregates
  const totalIncome = monthlyReports.reduce((acc, r) => acc + r.totalIncome, 0);
  const totalSalaries = monthlyReports.reduce((acc, r) => acc + r.totalSalaries, 0);
  const totalExpenses = monthlyReports.reduce((acc, r) => acc + r.totalExpenses, 0);
  const netProfit = totalIncome - totalSalaries - totalExpenses;
  const paidByCompany = monthlyReports.reduce((acc, r) => acc + r.paidByCompany, 0);
  const paidByPartners = monthlyReports.reduce((acc, r) => acc + r.paidByPartners, 0);
  const paidDirectlyByClients = monthlyReports.reduce((acc, r) => acc + r.paidDirectlyByClients, 0);

  // Aggregate monthly breakdowns
  const monthlyBreakdown = monthlyReports.map((r) => {
    if (partnerId) {
      const ps = r.partnerSettlements.find((p) => p.partnerId === partnerId);
      return {
        month: r.month,
        totalIncome: ps ? ps.profitShare : 0,
        totalSalaries: ps ? ps.salariesPaid : 0,
        totalExpenses: ps ? ps.expensesPaid : 0,
        netProfit: ps ? ps.netBalance : 0,
        paidByCompany: 0,
        paidByPartners: 0,
        paidDirectlyByClients: 0,
        partnerSettlements: r.partnerSettlements,
      };
    }
    return {
      month: r.month,
      totalIncome: r.totalIncome,
      totalSalaries: r.totalSalaries,
      totalExpenses: r.totalExpenses,
      netProfit: r.netProfit,
      paidByCompany: r.paidByCompany,
      paidByPartners: r.paidByPartners,
      paidDirectlyByClients: r.paidDirectlyByClients,
      partnerSettlements: r.partnerSettlements,
    };
  });

  // Aggregate Partner settlements
  const partnerSettlementsMap: Record<
    string,
    {
      partnerId: string;
      partnerName: string;
      profitShare: number;
      companyMoneyReceived: number;
      clientDirectSalaryReceived: number;
      totalCompanyMoneyReceived: number;
      salariesPaid: number;
      expensesPaid: number;
      credits: number;
      debits: number;
      netAdjustment: number;
      netBalance: number;
    }
  > = {};

  partners.forEach((partner) => {
    partnerSettlementsMap[partner.id] = {
      partnerId: partner.id,
      partnerName: partner.name,
      profitShare: 0,
      companyMoneyReceived: 0,
      clientDirectSalaryReceived: 0,
      totalCompanyMoneyReceived: 0,
      salariesPaid: 0,
      expensesPaid: 0,
      credits: 0,
      debits: 0,
      netAdjustment: 0,
      netBalance: 0,
    };
  });

  monthlyReports.forEach((mReport) => {
    mReport.partnerSettlements.forEach((ps) => {
      const entry = partnerSettlementsMap[ps.partnerId];
      if (entry) {
        entry.profitShare += ps.profitShare;
        entry.companyMoneyReceived += ps.companyMoneyReceived;
        entry.clientDirectSalaryReceived += ps.clientDirectSalaryReceived;
        entry.totalCompanyMoneyReceived += ps.totalCompanyMoneyReceived;
        entry.salariesPaid += ps.salariesPaid;
        entry.expensesPaid += ps.expensesPaid;
        entry.credits += ps.credits;
        entry.debits += ps.debits;
        entry.netAdjustment += ps.netAdjustment;
        entry.netBalance += ps.netBalance;
      }
    });
  });

  const partnerSettlements = Object.values(partnerSettlementsMap).map((entry) => ({
    ...entry,
    settlementType: (entry.netBalance >= 0 ? 'RECEIVABLE' : 'PAYABLE') as 'RECEIVABLE' | 'PAYABLE',
  }));

  // Aggregate yearly expense category breakdowns
  const yearlyExpenseCategorySums: Record<string, number> = {};
  monthlyReports.forEach((mr) => {
    mr.expensesByCategory.forEach((ec) => {
      yearlyExpenseCategorySums[ec.category] = (yearlyExpenseCategorySums[ec.category] || 0) + ec.amount;
    });
  });
  const expensesByCategory = Object.entries(yearlyExpenseCategorySums)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    totalIncome,
    totalSalaries,
    totalExpenses,
    netProfit,
    paidByCompany,
    paidByPartners,
    paidDirectlyByClients,
    monthlyBreakdown,
    partnerSettlements,
    expensesByCategory,
  };
}

export async function getMultiMonthFinanceReport(
  companyId: string,
  periods: { year: number; month: number }[],
  partnerId?: string
): Promise<MultiMonthFinanceReport> {
  if (!periods || periods.length === 0) {
    return {
      periods: [],
      totalIncome: 0,
      totalSalaries: 0,
      totalExpenses: 0,
      netProfit: 0,
      paidByCompany: 0,
      paidByPartners: 0,
      paidDirectlyByClients: 0,
      partnerSettlements: [],
      expensesByCategory: [],
      monthlyBreakdown: [],
    };
  }

  const orConditions = periods.map((p) => ({
    applicableYear: p.year,
    applicableMonth: p.month,
  }));

  const [partners, setups, payments, salaries, expenses, adjustments] = await Promise.all([
    prisma.partner.findMany({
      where: { companyId },
    }),
    prisma.ownershipSetup.findMany({
      where: { companyId },
      orderBy: { effectiveDate: 'desc' },
      include: {
        partnerOwnerships: {
          include: {
            partner: true,
          },
        },
      },
    }),
    prisma.projectPayment.findMany({
      where: {
        companyId,
        OR: orConditions,
        deletedAt: null,
      },
    }),
    prisma.employeeSalary.findMany({
      where: {
        companyId,
        OR: orConditions,
        deletedAt: null,
      },
    }),
    prisma.companyExpense.findMany({
      where: {
        companyId,
        OR: orConditions,
        deletedAt: null,
      },
    }),
    prisma.partnerAdjustment.findMany({
      where: {
        companyId,
        OR: orConditions,
        deletedAt: null,
      },
    }),
  ]);

  const monthlyReports: MonthlyFinanceReport[] = [];
  for (const p of periods) {
    const monthPrefetched: PreFetchedFinanceData = {
      partners,
      setups,
      payments: payments.filter((x) => x.applicableYear === p.year && x.applicableMonth === p.month),
      salaries: salaries.filter((x) => x.applicableYear === p.year && x.applicableMonth === p.month),
      expenses: expenses.filter((x) => x.applicableYear === p.year && x.applicableMonth === p.month),
      adjustments: adjustments.filter((x) => x.applicableYear === p.year && x.applicableMonth === p.month),
    };
    const r = await getMonthlyFinanceReport(companyId, p.year, p.month, partnerId, monthPrefetched);
    monthlyReports.push(r);
  }

  const totalIncome = monthlyReports.reduce((acc, r) => acc + r.totalIncome, 0);
  const totalSalaries = monthlyReports.reduce((acc, r) => acc + r.totalSalaries, 0);
  const totalExpenses = monthlyReports.reduce((acc, r) => acc + r.totalExpenses, 0);
  const netProfit = totalIncome - totalSalaries - totalExpenses;
  const paidByCompany = monthlyReports.reduce((acc, r) => acc + r.paidByCompany, 0);
  const paidByPartners = monthlyReports.reduce((acc, r) => acc + r.paidByPartners, 0);
  const paidDirectlyByClients = monthlyReports.reduce((acc, r) => acc + r.paidDirectlyByClients, 0);

  const partnerSettlementsMap: Record<string, PartnerMonthlySettlement> = {};
  monthlyReports.forEach((mr) => {
    mr.partnerSettlements.forEach((ps) => {
      if (!partnerSettlementsMap[ps.partnerId]) {
        partnerSettlementsMap[ps.partnerId] = {
          partnerId: ps.partnerId,
          partnerName: ps.partnerName,
          ownershipPercentage: ps.ownershipPercentage,
          profitShare: 0,
          companyMoneyReceived: 0,
          clientDirectSalaryReceived: 0,
          totalCompanyMoneyReceived: 0,
          salariesPaid: 0,
          expensesPaid: 0,
          credits: 0,
          debits: 0,
          netAdjustment: 0,
          netBalance: 0,
          settlementType: 'RECEIVABLE',
        };
      }
      const entry = partnerSettlementsMap[ps.partnerId];
      entry.profitShare += ps.profitShare;
      entry.companyMoneyReceived += ps.companyMoneyReceived;
      entry.clientDirectSalaryReceived += ps.clientDirectSalaryReceived;
      entry.totalCompanyMoneyReceived += ps.totalCompanyMoneyReceived;
      entry.salariesPaid += ps.salariesPaid;
      entry.expensesPaid += ps.expensesPaid;
      entry.credits += ps.credits;
      entry.debits += ps.debits;
      entry.netAdjustment += ps.netAdjustment;
      entry.netBalance += ps.netBalance;
    });
  });

  for (const pid in partnerSettlementsMap) {
    const activeMonthsCount = monthlyReports.filter(r => r.partnerSettlements.some(ps => ps.partnerId === pid)).length;
    if (activeMonthsCount > 0) {
      const sumPerc = monthlyReports.reduce((acc, r) => {
        const ps = r.partnerSettlements.find(p => p.partnerId === pid);
        return acc + (ps ? ps.ownershipPercentage : 0);
      }, 0);
      partnerSettlementsMap[pid].ownershipPercentage = Number((sumPerc / activeMonthsCount).toFixed(2));
    }
  }

  const partnerSettlements = Object.values(partnerSettlementsMap).map((entry) => ({
    ...entry,
    settlementType: (entry.netBalance >= 0 ? 'RECEIVABLE' : 'PAYABLE') as 'RECEIVABLE' | 'PAYABLE',
  }));

  const expenseCategorySums: Record<string, number> = {};
  monthlyReports.forEach((mr) => {
    mr.expensesByCategory.forEach((ec) => {
      expenseCategorySums[ec.category] = (expenseCategorySums[ec.category] || 0) + ec.amount;
    });
  });
  const expensesByCategory = Object.entries(expenseCategorySums)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyBreakdown = monthlyReports.map((r) => ({
    year: r.year,
    month: r.month,
    totalIncome: r.totalIncome,
    totalSalaries: r.totalSalaries,
    totalExpenses: r.totalExpenses,
    netProfit: r.netProfit,
    paidByCompany: r.paidByCompany,
    paidByPartners: r.paidByPartners,
    paidDirectlyByClients: r.paidDirectlyByClients,
    partnerSettlements: r.partnerSettlements,
  }));

  return {
    periods,
    totalIncome,
    totalSalaries,
    totalExpenses,
    netProfit,
    paidByCompany,
    paidByPartners,
    paidDirectlyByClients,
    partnerSettlements,
    expensesByCategory,
    monthlyBreakdown,
  };
}
