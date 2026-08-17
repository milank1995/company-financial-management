import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { parseFilterParams, buildPrismaDateFilter, toNumber } from '@/lib/queryFilters';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const params = parseFilterParams(req.url);

    // Build Where Clause for Payments
    const where: any = {
      companyId: user.companyId,
      deletedAt: null,
    };

    // Date/Period Filter
    if (params.periodType === 'monthly') {
      where.applicableYear = params.year || 2026;
      where.applicableMonth = params.month || 8;
    } else if (params.periodType === 'yearly') {
      where.applicableYear = params.year || 2026;
    } else if (params.periodType === 'custom') {
      const dateFilter = buildPrismaDateFilter(
        params.periodType,
        params.year || 2026,
        params.month || 8,
        params.startDate,
        params.endDate
      );
      if (dateFilter) {
        where.paymentDate = dateFilter;
      }
    }

    // Project Filter
    if (params.projectId) {
      where.projectId = params.projectId;
    }

    // Partner who received payment filter
    if (params.partnerId) {
      where.partnerId = params.partnerId;
    }

    // Search Filter (project name or client name)
    if (params.search) {
      where.AND = [
        {
          OR: [
            { project: { name: { contains: params.search, mode: 'insensitive' } } },
            { clientName: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // 1. Get Total Count
    const totalItems = await prisma.projectPayment.count({ where });

    // 2. Fetch all matching payments for aggregates (without pagination)
    const summaryPayments = await prisma.projectPayment.findMany({
      where,
      select: {
        amount: true,
        projectId: true,
      },
    });

    const totalAmountReceived = summaryPayments.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const numberOfPayments = summaryPayments.length;

    // Get unique project IDs from filtered payments to sum their budget, or check all projects if no payments
    const uniqueProjectIds = Array.from(new Set(summaryPayments.map((p) => p.projectId)));
    
    // Build project filter to get budgets
    const projectWhere: any = {
      companyId: user.companyId,
      isActive: true,
    };
    if (params.projectId) {
      projectWhere.id = params.projectId;
    } else if (uniqueProjectIds.length > 0) {
      projectWhere.id = { in: uniqueProjectIds };
    } else if (params.search) {
      projectWhere.name = { contains: params.search, mode: 'insensitive' };
    }

    const projectsList = await prisma.project.findMany({
      where: projectWhere,
      select: { totalAmount: true },
    });

    const totalProjectAmount = projectsList.reduce((acc, curr) => acc + toNumber(curr.totalAmount), 0);
    const outstandingAmount = Math.max(0, totalProjectAmount - totalAmountReceived);

    const summary = {
      totalProjectAmount,
      totalAmountReceived,
      numberOfPayments,
      outstandingAmount,
    };

    // 3. Fetch Paginated Page
    const skip = (params.page! - 1) * params.limit!;
    const items = await prisma.projectPayment.findMany({
      where,
      include: {
        project: true,
        partner: true,
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take: params.limit!,
    });

    return NextResponse.json({
      items,
      total: totalItems,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(totalItems / params.limit!),
      summary,
    });
  } catch (error) {
    console.error('Fetch payments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { projectId, amount, paymentDate, partnerId, clientName, applicableMonth, applicableYear } = await req.json();

    if (!projectId || !amount || !paymentDate || !partnerId) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    const parsedDate = new Date(paymentDate);
    const resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : (parsedDate.getMonth() + 1);
    const resolvedYear = applicableYear !== undefined ? Number(applicableYear) : parsedDate.getFullYear();

    const payment = await prisma.projectPayment.create({
      data: {
        projectId,
        amount: Number(amount),
        paymentDate: parsedDate,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
        partnerId,
        clientName: clientName || null,
        companyId: user.companyId,
        createdBy: user.userId,
      },
      include: {
        project: true,
        partner: true,
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
