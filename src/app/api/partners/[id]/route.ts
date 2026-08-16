import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const { name, email, isActive } = await req.json();

    const partner = await prisma.partner.update({
      where: { id, companyId: user.companyId },
      data: {
        name,
        email: email || null,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: user.userId,
      },
    });

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Update partner error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    // Attempt to delete partner
    await prisma.partner.delete({
      where: { id, companyId: user.companyId },
    });
    return NextResponse.json({ message: 'Partner deleted successfully' });
  } catch (error: any) {
    console.error('Delete partner error:', error);
    // If it violates database reference constraints (P2003 or similar in prisma)
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete partner because they have historical transactions. Please deactivate them instead.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
