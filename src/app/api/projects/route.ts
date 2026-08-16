import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Fetch projects error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { name, description, totalAmount, isActive } = await req.json();

    if (!name || totalAmount === undefined) {
      return NextResponse.json({ error: 'Name and Total Amount are required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        totalAmount: Number(totalAmount),
        isActive: isActive !== undefined ? isActive : true,
        companyId: user.companyId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('Create project error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Project with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
