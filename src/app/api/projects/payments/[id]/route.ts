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
    const existing = await prisma.projectPayment.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const isCurrentSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isCurrentSettled) {
      return NextResponse.json({ error: 'Cannot modify a payment in a settled period' }, { status: 400 });
    }

    const { amount, paymentDate, partnerId, projectId, applicableMonth, applicableYear } = await req.json();

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : existing.applicableMonth;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : existing.applicableYear;

    if (paymentDate && applicableMonth === undefined && applicableYear === undefined) {
      const parsedDate = new Date(paymentDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedMonth = parsedDate.getMonth() + 1;
        resolvedYear = parsedDate.getFullYear();
      }
    }

    const isNewSettled = await checkPeriodSettled(user.companyId, resolvedYear, resolvedMonth);
    if (isNewSettled) {
      return NextResponse.json({ error: 'Cannot move a payment into a settled period' }, { status: 400 });
    }

    const payment = await prisma.projectPayment.update({
      where: { id, companyId: user.companyId },
      data: {
        projectId,
        amount: amount !== undefined ? Number(amount) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
        partnerId,
        updatedBy: user.userId,
      },
      include: {
        project: true,
        partner: true,
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const existing = await prisma.projectPayment.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const isSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isSettled) {
      return NextResponse.json({ error: 'Cannot delete a payment in a settled period' }, { status: 400 });
    }

    // Soft-delete
    const payment = await prisma.projectPayment.update({
      where: { id, companyId: user.companyId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    });

    return NextResponse.json({ message: 'Payment soft-deleted successfully', id: payment.id });
  } catch (error) {
    console.error('Soft-delete payment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
