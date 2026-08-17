import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const periodType = searchParams.get('periodType') || undefined;
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    const where: any = {
      companyId: user.companyId,
      deletedAt: null,
    };

    if (periodType === 'monthly') {
      where.applicableYear = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
      where.applicableMonth = monthStr ? parseInt(monthStr, 10) : (new Date().getMonth() + 1);
    } else if (periodType === 'yearly') {
      where.applicableYear = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    }

    const adjustments = await prisma.partnerAdjustment.findMany({
      where,
      include: {
        partner: true,
      },
      orderBy: { adjustmentDate: 'desc' },
    });
    return NextResponse.json(adjustments);
  } catch (error) {
    console.error('Fetch adjustments error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { partnerId, amount, type, adjustmentDate, description, applicableMonth, applicableYear } = await req.json();

    if (!partnerId || amount === undefined || !type || !adjustmentDate || !description) {
      return NextResponse.json({ error: 'Missing required adjustment fields' }, { status: 400 });
    }

    const parsedDate = new Date(adjustmentDate);
    const resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : (parsedDate.getMonth() + 1);
    const resolvedYear = applicableYear !== undefined ? Number(applicableYear) : parsedDate.getFullYear();

    const adjustment = await prisma.partnerAdjustment.create({
      data: {
        partnerId,
        amount: Number(amount),
        type,
        adjustmentDate: parsedDate,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
        description,
        companyId: user.companyId,
        createdBy: user.userId,
      },
      include: {
        partner: true,
      },
    });

    return NextResponse.json(adjustment);
  } catch (error) {
    console.error('Create adjustment error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
