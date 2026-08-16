import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const { name, description, totalAmount, isActive } = await req.json();

    const project = await prisma.project.update({
      where: { id, companyId: user.companyId },
      data: {
        name,
        description: description || null,
        totalAmount: totalAmount !== undefined ? Number(totalAmount) : undefined,
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: user.userId,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    await prisma.project.delete({
      where: { id, companyId: user.companyId },
    });
    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete project because it has associated payments. Please deactivate it instead.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
