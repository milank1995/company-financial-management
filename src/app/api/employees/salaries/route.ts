import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { SalaryPaymentSource } from '@prisma/client';
import { NextResponse } from 'next/server';
import { parseFilterParams, buildPrismaDateFilter, toNumber } from '@/lib/queryFilters';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const params = parseFilterParams(req.url);

    // Build Where Clause
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
        where.paymentDate = dateFilter;
      }
    }

    // Employee Filter
    if (params.employeeId) {
      where.employeeId = params.employeeId;
    }

    // Payment Source Filter
    if (params.paymentSource) {
      where.paymentSource = params.paymentSource as SalaryPaymentSource;
    }

    // Partner Filter (Paid personally OR Received by partner)
    if (params.partnerId) {
      where.OR = [
        { partnerId: params.partnerId },
        { receivedByPartnerId: params.partnerId },
      ];
    }

    // Received By Partner filter
    if (params.receivedByPartnerId) {
      where.receivedByPartnerId = params.receivedByPartnerId;
    }

    // Search Filter
    if (params.search) {
      where.AND = [
        {
          OR: [
            { employee: { name: { contains: params.search, mode: 'insensitive' } } },
            { clientName: { contains: params.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // 1. Get Total Count for Pagination
    const totalItems = await prisma.employeeSalary.count({ where });

    // 2. Fetch all matching items for summary aggregates (without pagination)
    const summaryItems = await prisma.employeeSalary.findMany({
      where,
      select: {
        amount: true,
        paymentSource: true,
      },
    });

    const totalSalaryExpense = summaryItems.reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const paidByCompany = summaryItems
      .filter((s) => s.paymentSource === SalaryPaymentSource.COMPANY)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const paidByPartners = summaryItems
      .filter((s) => s.paymentSource === SalaryPaymentSource.PARTNER)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);
    const paidDirectlyByClients = summaryItems
      .filter((s) => s.paymentSource === SalaryPaymentSource.CLIENT_DIRECT)
      .reduce((acc, curr) => acc + toNumber(curr.amount), 0);

    const summary = {
      totalSalaryExpense,
      paidByCompany,
      paidByPartners,
      paidDirectlyByClients,
    };

    // 3. Fetch Paginated Page
    const skip = (params.page! - 1) * params.limit!;
    const items = await prisma.employeeSalary.findMany({
      where,
      include: {
        employee: true,
        partner: true,
        receivedByPartner: true,
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
    console.error('Fetch salaries error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const {
      employeeId,
      amount,
      paymentDate,
      paymentSource,
      partnerId,
      clientName,
      receivedByPartnerId,
    } = await req.json();

    if (!employeeId || !amount || !paymentDate || !paymentSource) {
      return NextResponse.json({ error: 'Missing required salary fields' }, { status: 400 });
    }

    // Validation based on paymentSource
    let finalPartnerId: string | null = null;
    let finalClientName: string | null = null;
    let finalReceivedByPartnerId: string | null = null;

    if (paymentSource === SalaryPaymentSource.PARTNER) {
      if (!partnerId) {
        return NextResponse.json({ error: 'Partner selection is required for partner paid source' }, { status: 400 });
      }
      finalPartnerId = partnerId;
    } else if (paymentSource === SalaryPaymentSource.CLIENT_DIRECT) {
      if (!clientName) {
        return NextResponse.json({ error: 'Client Name is required for client direct source' }, { status: 400 });
      }
      finalClientName = clientName;
      finalReceivedByPartnerId = receivedByPartnerId || null;
    }

    const salary = await prisma.employeeSalary.create({
      data: {
        employeeId,
        amount: Number(amount),
        paymentDate: new Date(paymentDate),
        paymentSource: paymentSource as SalaryPaymentSource,
        partnerId: finalPartnerId,
        clientName: finalClientName,
        receivedByPartnerId: finalReceivedByPartnerId,
        companyId: user.companyId,
        createdBy: user.userId,
      },
      include: {
        employee: true,
        partner: true,
        receivedByPartner: true,
      },
    });

    return NextResponse.json(salary);
  } catch (error) {
    console.error('Create salary error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
