import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Fetch employees error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { name, email, role, isActive } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        email: email || null,
        role: role || null,
        isActive: isActive !== undefined ? isActive : true,
        companyId: user.companyId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error('Create employee error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Employee with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
