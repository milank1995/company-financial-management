import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password, name, companyName } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Find or create company
    const targetCompanyName = companyName || 'My Company';
    let company = await prisma.company.findUnique({
      where: { name: targetCompanyName },
    });

    if (!company) {
      company = await prisma.company.create({
        data: { name: targetCompanyName },
      });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    return NextResponse.json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, name: user.name, companyId: user.companyId },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
