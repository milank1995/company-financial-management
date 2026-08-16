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
  month: number
): Promise<MonthlyFinanceReport> {
  const { start, end } = getMonthBoundaries(year, month);

  // Fetch partners
  const partners = await prisma.partner.findMany({
    where: { companyId },
  });

  // Fetch transactions
  const payments = await prisma.projectPayment.findMany({
    where: {
      companyId,
      paymentDate: { gte: start, lt: end },
      deletedAt: null,
    },
  });

  const salaries = await prisma.employeeSalary.findMany({
    where: {
      companyId,
      paymentDate: { gte: start, lt: end },
      deletedAt: null,
    },
  });

  const expenses = await prisma.companyExpense.findMany({
    where: {
      companyId,
      expenseDate: { gte: start, lt: end },
      deletedAt: null,
    },
  });

  const adjustments = await prisma.partnerAdjustment.findMany({
    where: {
      companyId,
      adjustmentDate: { gte: start, lt: end },
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
  const { percentages } = await resolveOwnershipPercentages(companyId, start);

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
  };
}

/**
 * Calculates yearly report as aggregation of monthly values.
 */
export async function getYearlyFinanceReport(
  companyId: string,
  year: number
): Promise<YearlyFinanceReport> {
  const monthlyReports: MonthlyFinanceReport[] = [];

  for (let m = 1; m <= 12; m++) {
    const report = await getMonthlyFinanceReport(companyId, year, m);
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
  const monthlyBreakdown = monthlyReports.map((r) => ({
    month: r.month,
    totalIncome: r.totalIncome,
    totalSalaries: r.totalSalaries,
    totalExpenses: r.totalExpenses,
    netProfit: r.netProfit,
    paidByCompany: r.paidByCompany,
    paidByPartners: r.paidByPartners,
    paidDirectlyByClients: r.paidDirectlyByClients,
  }));

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

  const partners = await prisma.partner.findMany({ where: { companyId } });
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
  };
}
