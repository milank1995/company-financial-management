import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { SalaryPaymentSource } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const {
      amount,
      paymentDate,
      employeeId,
      paymentSource,
      partnerId,
      clientName,
      receivedByPartnerId,
    } = await req.json();

    if (!paymentSource) {
      return NextResponse.json({ error: 'Payment source is required' }, { status: 400 });
    }

    // Validation based on paymentSource
    let finalPartnerId: string | null = null;
    let finalClientName: string | null = null;
    let finalReceivedByPartnerId: string | null = null;

    if (paymentSource === SalaryPaymentSource.PARTNER) {
      if (!partnerId) {
        return NextResponse.json({ error: 'Partner selection is required for partner paid source' }, { status: 400 });
      }
      finalPartnerId = partnerId;
    } else if (paymentSource === SalaryPaymentSource.CLIENT_DIRECT) {
      if (!clientName) {
        return NextResponse.json({ error: 'Client Name is required for client direct source' }, { status: 400 });
      }
      finalClientName = clientName;
      finalReceivedByPartnerId = receivedByPartnerId || null;
    }

    const salary = await prisma.employeeSalary.update({
      where: { id, companyId: user.companyId },
      data: {
        employeeId,
        amount: amount !== undefined ? Number(amount) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        paymentSource: paymentSource as SalaryPaymentSource,
        partnerId: finalPartnerId,
        clientName: finalClientName,
        receivedByPartnerId: finalReceivedByPartnerId,
        updatedBy: user.userId,
      },
      include: {
        employee: true,
        partner: true,
        receivedByPartner: true,
      },
    });

    return NextResponse.json(salary);
  } catch (error) {
    console.error('Update salary error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const salary = await prisma.employeeSalary.update({
      where: { id, companyId: user.companyId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    });

    return NextResponse.json({ message: 'Salary soft-deleted successfully', id: salary.id });
  } catch (error) {
    console.error('Soft-delete salary error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
