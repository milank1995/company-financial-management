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

    // Build Where Clause for Expenses
    const where: any = {
      companyId: user.companyId,
      deletedAt: null,
    };

    // Date Filter
    if (params.periodType) {
      const dateFilter = buildPrismaDateFilter(
        params.periodType,
        params.year || 2026,
        params.month || 8,
        params.startDate,
        params.endDate
      );
      if (dateFilter) {
        where.expenseDate = dateFilter;
      }
    }

    // Expense Category Filter
    if (params.category) {
      where.category = params.category;
    }

    // Partner Filter
    if (params.partnerId) {
      where.partnerId = params.partnerId;
    }

    // Search Filter
    if (params.search) {
      where.description = { contains: params.search, mode: 'insensitive' };
    }

    // 1. Get Total Count
    const totalItems = await prisma.companyExpense.count({ where });

    // 2. Fetch all matching items for summary aggregates (without pagination)
    const summaryExpenses = await prisma.companyExpense.findMany({
      where,
      select: {
        amount: true,
        partnerId: true,
      },
    });

    const totalExpenses = summaryExpenses.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const numberOfExpenses = summaryExpenses.length;

    // Calculate Expenses Paid by Each Partner within filtered scope
    const partnerGroupSums: Record<string, number> = {};
    summaryExpenses.forEach((exp) => {
      partnerGroupSums[exp.partnerId] = (partnerGroupSums[exp.partnerId] || 0) + toNumber(exp.amount);
    });

    const partners = await prisma.partner.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    });

    const expensesPaidByPartner = partners.map((partner) => ({
      partnerId: partner.id,
      partnerName: partner.name,
      amountPaid: partnerGroupSums[partner.id] || 0,
    }));

    const summary = {
      totalExpenses,
      numberOfExpenses,
      expensesPaidByPartner,
    };

    // 3. Fetch Paginated Page
    const skip = (params.page! - 1) * params.limit!;
    const items = await prisma.companyExpense.findMany({
      where,
      include: {
        partner: true,
      },
      orderBy: { expenseDate: 'desc' },
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
    console.error('Fetch expenses error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { amount, category, expenseDate, description, partnerId } = await req.json();

    if (!amount || !category || !expenseDate || !partnerId || !description) {
      return NextResponse.json({ error: 'Missing required expense fields' }, { status: 400 });
    }

    const expense = await prisma.companyExpense.create({
      data: {
        amount: Number(amount),
        category,
        expenseDate: new Date(expenseDate),
        description,
        partnerId,
        companyId: user.companyId,
        createdBy: user.userId,
      },
      include: {
        partner: true,
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
