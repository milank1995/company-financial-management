import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const { amount, category, expenseDate, description, partnerId } = await req.json();

    const expense = await prisma.companyExpense.update({
      where: { id, companyId: user.companyId },
      data: {
        amount: amount !== undefined ? Number(amount) : undefined,
        category,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
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
