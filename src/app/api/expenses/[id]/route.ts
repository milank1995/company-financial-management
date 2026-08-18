import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkPeriodSettled } from '@/services/financeService';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const existing = await prisma.companyExpense.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const isCurrentSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isCurrentSettled) {
      return NextResponse.json({ error: 'Cannot modify an expense in a settled period' }, { status: 400 });
    }

    const { amount, category, expenseDate, description, partnerId, applicableMonth, applicableYear } = await req.json();

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : existing.applicableMonth;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : existing.applicableYear;

    if (expenseDate && applicableMonth === undefined && applicableYear === undefined) {
      const parsedDate = new Date(expenseDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedMonth = parsedDate.getMonth() + 1;
        resolvedYear = parsedDate.getFullYear();
      }
    }

    const isNewSettled = await checkPeriodSettled(user.companyId, resolvedYear, resolvedMonth);
    if (isNewSettled) {
      return NextResponse.json({ error: 'Cannot move an expense into a settled period' }, { status: 400 });
    }

    const expense = await prisma.companyExpense.update({
      where: { id, companyId: user.companyId },
      data: {
        amount: amount !== undefined ? Number(amount) : undefined,
        category,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
        description,
        partnerId,
        updatedBy: user.userId,
      },
      include: {
        partner: true,
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Update expense error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const existing = await prisma.companyExpense.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const isSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isSettled) {
      return NextResponse.json({ error: 'Cannot delete an expense in a settled period' }, { status: 400 });
    }

    const expense = await prisma.companyExpense.update({
      where: { id, companyId: user.companyId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    });

    return NextResponse.json({ message: 'Expense soft-deleted successfully', id: expense.id });
  } catch (error) {
    console.error('Soft-delete expense error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
