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
    const existing = await prisma.partnerAdjustment.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    const isCurrentSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isCurrentSettled) {
      return NextResponse.json({ error: 'Cannot modify an adjustment in a settled period' }, { status: 400 });
    }

    const { partnerId, amount, type, adjustmentDate, description, applicableMonth, applicableYear } = await req.json();

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : existing.applicableMonth;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : existing.applicableYear;

    if (adjustmentDate && applicableMonth === undefined && applicableYear === undefined) {
      const parsedDate = new Date(adjustmentDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedMonth = parsedDate.getMonth() + 1;
        resolvedYear = parsedDate.getFullYear();
      }
    }

    const isNewSettled = await checkPeriodSettled(user.companyId, resolvedYear, resolvedMonth);
    if (isNewSettled) {
      return NextResponse.json({ error: 'Cannot move an adjustment into a settled period' }, { status: 400 });
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
    const existing = await prisma.partnerAdjustment.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    const isSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isSettled) {
      return NextResponse.json({ error: 'Cannot delete an adjustment in a settled period' }, { status: 400 });
    }

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
