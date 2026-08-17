import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const { amount, paymentDate, partnerId, projectId, applicableMonth, applicableYear } = await req.json();

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : undefined;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : undefined;

    if (resolvedMonth === undefined || resolvedYear === undefined) {
      if (paymentDate) {
        const parsedDate = new Date(paymentDate);
        if (!isNaN(parsedDate.getTime())) {
          if (resolvedMonth === undefined) resolvedMonth = parsedDate.getMonth() + 1;
          if (resolvedYear === undefined) resolvedYear = parsedDate.getFullYear();
        }
      }
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
