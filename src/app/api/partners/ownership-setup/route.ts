import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const setups = await prisma.ownershipSetup.findMany({
      where: { companyId: user.companyId },
      orderBy: { effectiveDate: 'desc' },
      include: {
        partnerOwnerships: {
          include: {
            partner: true,
          },
        },
      },
    });
    return NextResponse.json(setups);
  } catch (error) {
    console.error('Fetch setups error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { effectiveDate, ownerships } = await req.json();

    if (!effectiveDate || !ownerships || !Array.isArray(ownerships)) {
      return NextResponse.json({ error: 'Missing effective date or ownership list' }, { status: 400 });
    }

    // Verify percentages sum to exactly 100%
    const sum = ownerships.reduce((acc, curr) => acc + Number(curr.percentage), 0);
    if (Math.abs(sum - 100.0) > 0.01) {
      return NextResponse.json(
        { error: `Total ownership must sum to exactly 100%. Current sum: ${sum}%` },
        { status: 400 }
      );
    }

    const parsedDate = new Date(effectiveDate);
    // Align to the start of the day in UTC for consistent comparisons
    const utcDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0));

    // Check if an ownership setup already exists for this exact effective date
    const existingSetup = await prisma.ownershipSetup.findFirst({
      where: {
        companyId: user.companyId,
        effectiveDate: utcDate,
      },
    });

    if (existingSetup) {
      return NextResponse.json(
        { error: 'An ownership setup already exists for this effective date. Please edit that one or choose another date.' },
        { status: 400 }
      );
    }

    // Create the setup and its partner ownership entries
    const setup = await prisma.ownershipSetup.create({
      data: {
        companyId: user.companyId,
        effectiveDate: utcDate,
        createdBy: user.userId,
        partnerOwnerships: {
          create: ownerships.map((o) => ({
            partnerId: o.partnerId,
            percentage: Number(o.percentage) / 100.0, // Store 25% as 0.2500
            createdBy: user.userId,
          })),
        },
      },
      include: {
        partnerOwnerships: true,
      },
    });

    return NextResponse.json(setup);
  } catch (error) {
    console.error('Create ownership setup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
