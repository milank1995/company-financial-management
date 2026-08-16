import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const adjustments = await prisma.partnerAdjustment.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
      },
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
    const { partnerId, amount, type, adjustmentDate, description } = await req.json();

    if (!partnerId || amount === undefined || !type || !adjustmentDate || !description) {
      return NextResponse.json({ error: 'Missing required adjustment fields' }, { status: 400 });
    }

    const adjustment = await prisma.partnerAdjustment.create({
      data: {
        partnerId,
        amount: Number(amount),
        type,
        adjustmentDate: new Date(adjustmentDate),
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
