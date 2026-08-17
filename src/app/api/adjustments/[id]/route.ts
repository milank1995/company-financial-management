import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const { partnerId, amount, type, adjustmentDate, description, applicableMonth, applicableYear } = await req.json();

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : undefined;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : undefined;

    if (resolvedMonth === undefined || resolvedYear === undefined) {
      if (adjustmentDate) {
        const parsedDate = new Date(adjustmentDate);
        if (!isNaN(parsedDate.getTime())) {
          if (resolvedMonth === undefined) resolvedMonth = parsedDate.getMonth() + 1;
          if (resolvedYear === undefined) resolvedYear = parsedDate.getFullYear();
        }
      }
    }

    const adjustment = await prisma.partnerAdjustment.update({
      where: { id, companyId: user.companyId },
      data: {
        partnerId,
        amount: amount !== undefined ? Number(amount) : undefined,
        type,
        adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : undefined,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
        description,
        updatedBy: user.userId,
      },
      include: {
        partner: true,
      },
    });

    return NextResponse.json(adjustment);
  } catch (error) {
    console.error('Update adjustment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const adjustment = await prisma.partnerAdjustment.update({
      where: { id, companyId: user.companyId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    });

    return NextResponse.json({ message: 'Adjustment soft-deleted successfully', id: adjustment.id });
  } catch (error) {
    console.error('Soft-delete adjustment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
