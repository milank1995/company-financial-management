import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const partners = await prisma.partner.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(partners);
  } catch (error) {
    console.error('Fetch partners error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { name, email, isActive } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const partner = await prisma.partner.create({
      data: {
        name,
        email: email || null,
        isActive: isActive !== undefined ? isActive : true,
        companyId: user.companyId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json(partner);
  } catch (error: any) {
    console.error('Create partner error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Partner with this name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
