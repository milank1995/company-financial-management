import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const statuses = await prisma.periodSettlement.findMany({
      where: {
        companyId: user.companyId,
      },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    console.error('Fetch settlement statuses error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { year, month, isSettled, notes } = await req.json();

    if (year === undefined || month === undefined || isSettled === undefined) {
      return NextResponse.json({ error: 'Missing required fields: year, month, isSettled' }, { status: 400 });
    }

    const periodSettlement = await prisma.periodSettlement.upsert({
      where: {
        companyId_year_month: {
          companyId: user.companyId,
          year: Number(year),
          month: Number(month),
        },
      },
      update: {
        isSettled: Boolean(isSettled),
        settledAt: isSettled ? new Date() : null,
        settledBy: isSettled ? user.email : null,
        notes: notes || null,
      },
      create: {
        companyId: user.companyId,
        year: Number(year),
        month: Number(month),
        isSettled: Boolean(isSettled),
        settledAt: isSettled ? new Date() : null,
        settledBy: isSettled ? user.email : null,
        notes: notes || null,
      },
    });

    return NextResponse.json(periodSettlement);
  } catch (error) {
    console.error('Upsert settlement status error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
