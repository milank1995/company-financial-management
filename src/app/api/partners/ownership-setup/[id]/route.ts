import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

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
    const utcDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0));

    // Update setup date
    await prisma.ownershipSetup.update({
      where: { id, companyId: user.companyId },
      data: {
        effectiveDate: utcDate,
        updatedBy: user.userId,
      },
    });

    // Delete existing ownership entries
    await prisma.partnerOwnership.deleteMany({
      where: { setupId: id },
    });

    // Recreate new ownership entries
    await prisma.partnerOwnership.createMany({
      data: ownerships.map((o) => ({
        setupId: id,
        partnerId: o.partnerId,
        percentage: Number(o.percentage) / 100.0, // Convert e.g., 25% -> 0.2500
        createdBy: user.userId,
      })),
    });

    const updatedSetup = await prisma.ownershipSetup.findUnique({
      where: { id },
      include: {
        partnerOwnerships: {
          include: {
            partner: true,
          },
        },
      },
    });

    return NextResponse.json(updatedSetup);
  } catch (error) {
    console.error('Update ownership setup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    await prisma.ownershipSetup.delete({
      where: { id, companyId: user.companyId },
    });
    return NextResponse.json({ message: 'Ownership setup deleted successfully' });
  } catch (error) {
    console.error('Delete ownership setup error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
