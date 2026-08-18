import { checkAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId') || undefined;
    const type = searchParams.get('type');
    const periodsParam = searchParams.get('periods');

    if (!type) {
      return NextResponse.json({ error: 'Type parameter is required' }, { status: 400 });
    }

    if (!periodsParam) {
      return NextResponse.json({ error: 'Periods parameter is required' }, { status: 400 });
    }

    const periods = periodsParam
      .split(',')
      .map((p) => {
        const parts = p.trim().split('-');
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10),
        };
      })
      .filter((p) => !isNaN(p.year) && !isNaN(p.month));

    if (periods.length === 0) {
      return NextResponse.json({ error: 'No valid periods specified' }, { status: 400 });
    }

    // Helper condition for periods
    const periodFilters = periods.map((p) => ({
      applicableYear: p.year,
      applicableMonth: p.month,
    }));

    let result: any = [];

    // Switch on drilldown type
    switch (type) {
      case 'salaries_paid': {
        // Salaries paid personally by this partner
        if (!partnerId) {
          return NextResponse.json({ error: 'Partner ID is required for salaries_paid' }, { status: 400 });
        }
        result = await prisma.employeeSalary.findMany({
          where: {
            companyId: user.companyId,
            paymentSource: 'PARTNER',
            partnerId: partnerId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            employee: {
              select: { name: true, role: true },
            },
          },
          orderBy: { paymentDate: 'desc' },
        });
        break;
      }

      case 'expenses_paid': {
        // Expenses paid personally by this partner
        if (!partnerId) {
          return NextResponse.json({ error: 'Partner ID is required for expenses_paid' }, { status: 400 });
        }
        result = await prisma.companyExpense.findMany({
          where: {
            companyId: user.companyId,
            partnerId: partnerId,
            deletedAt: null,
            OR: periodFilters,
          },
          orderBy: { expenseDate: 'desc' },
        });
        break;
      }

      case 'client_direct': {
        // Client direct salaries received by this partner
        if (!partnerId) {
          return NextResponse.json({ error: 'Partner ID is required for client_direct' }, { status: 400 });
        }
        result = await prisma.employeeSalary.findMany({
          where: {
            companyId: user.companyId,
            paymentSource: 'CLIENT_DIRECT',
            receivedByPartnerId: partnerId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            employee: {
              select: { name: true, role: true },
            },
          },
          orderBy: { paymentDate: 'desc' },
        });
        break;
      }

      case 'project_payments': {
        // Project payments received personally by this partner
        if (!partnerId) {
          return NextResponse.json({ error: 'Partner ID is required for project_payments' }, { status: 400 });
        }
        result = await prisma.projectPayment.findMany({
          where: {
            companyId: user.companyId,
            partnerId: partnerId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            project: {
              select: { name: true },
            },
          },
          orderBy: { paymentDate: 'desc' },
        });
        break;
      }

      case 'adjustments':
      case 'credits':
      case 'debits': {
        // Adjustments/Credits/Debits for this partner
        if (!partnerId) {
          return NextResponse.json({ error: 'Partner ID is required for adjustments' }, { status: 400 });
        }
        
        let typeCondition: any = undefined;
        if (type === 'credits') {
          typeCondition = 'CREDIT';
        } else if (type === 'debits') {
          typeCondition = 'DEBIT';
        }

        result = await prisma.partnerAdjustment.findMany({
          where: {
            companyId: user.companyId,
            partnerId: partnerId,
            deletedAt: null,
            ...(typeCondition ? { type: typeCondition } : {}),
            OR: periodFilters,
          },
          orderBy: { adjustmentDate: 'desc' },
        });
        break;
      }

      case 'profit_share': {
        // Returns the ingredients for the profit share calculation
        // 1. All project payments (Income)
        // 2. All company expenses + all employee salaries (Expenses)
        // 3. Ownership setups active during the periods
        const incomePayments = await prisma.projectPayment.findMany({
          where: {
            companyId: user.companyId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            project: { select: { name: true } },
            partner: { select: { name: true } },
          },
          orderBy: { paymentDate: 'desc' },
        });

        const salaries = await prisma.employeeSalary.findMany({
          where: {
            companyId: user.companyId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            employee: { select: { name: true } },
            partner: { select: { name: true } },
          },
          orderBy: { paymentDate: 'desc' },
        });

        const companyExpenses = await prisma.companyExpense.findMany({
          where: {
            companyId: user.companyId,
            deletedAt: null,
            OR: periodFilters,
          },
          include: {
            partner: { select: { name: true } },
          },
          orderBy: { expenseDate: 'desc' },
        });

        // Fetch ownership setup history
        const ownershipSetups = await prisma.ownershipSetup.findMany({
          where: { companyId: user.companyId },
          include: {
            partnerOwnerships: {
              include: { partner: { select: { name: true } } },
            },
          },
          orderBy: { effectiveDate: 'asc' },
        });

        result = {
          income: incomePayments,
          salaries: salaries,
          expenses: companyExpenses,
          ownershipSetups: ownershipSetups,
        };
        break;
      }

      default: {
        return NextResponse.json({ error: 'Invalid drilldown type' }, { status: 400 });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[DRILLDOWN_API_ERROR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
