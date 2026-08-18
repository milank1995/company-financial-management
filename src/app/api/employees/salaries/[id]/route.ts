import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { SalaryPaymentSource } from '@prisma/client';
import { NextResponse } from 'next/server';
import { checkPeriodSettled } from '@/services/financeService';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;
  const { id } = await params;

  try {
    const existing = await prisma.employeeSalary.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Salary not found' }, { status: 404 });
    }

    const isCurrentSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isCurrentSettled) {
      return NextResponse.json({ error: 'Cannot modify a salary in a settled period' }, { status: 400 });
    }

    const {
      amount,
      paymentDate,
      employeeId,
      paymentSource,
      partnerId,
      clientName,
      receivedByPartnerId,
      applicableMonth,
      applicableYear,
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

    // Resolve target accounting period
    let resolvedMonth = applicableMonth !== undefined ? Number(applicableMonth) : existing.applicableMonth;
    let resolvedYear = applicableYear !== undefined ? Number(applicableYear) : existing.applicableYear;

    if (paymentDate && applicableMonth === undefined && applicableYear === undefined) {
      const parsedDate = new Date(paymentDate);
      if (!isNaN(parsedDate.getTime())) {
        let m = parsedDate.getMonth(); // 0 to 11 (corresponds to month-1)
        let y = parsedDate.getFullYear();
        if (m === 0) {
          m = 12;
          y -= 1;
        }
        resolvedMonth = m;
        resolvedYear = y;
      }
    }

    const isNewSettled = await checkPeriodSettled(user.companyId, resolvedYear, resolvedMonth);
    if (isNewSettled) {
      return NextResponse.json({ error: 'Cannot move a salary into a settled period' }, { status: 400 });
    }

    const salary = await prisma.employeeSalary.update({
      where: { id, companyId: user.companyId },
      data: {
        employeeId,
        amount: amount !== undefined ? Number(amount) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        applicableMonth: resolvedMonth,
        applicableYear: resolvedYear,
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
    const existing = await prisma.employeeSalary.findUnique({
      where: { id, companyId: user.companyId }
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Salary not found' }, { status: 404 });
    }

    const isSettled = await checkPeriodSettled(user.companyId, existing.applicableYear, existing.applicableMonth);
    if (isSettled) {
      return NextResponse.json({ error: 'Cannot delete a salary in a settled period' }, { status: 400 });
    }

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
