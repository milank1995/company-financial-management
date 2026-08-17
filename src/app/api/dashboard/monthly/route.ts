import { checkAuth } from '@/lib/auth';
import { getMonthlyFinanceReport, getMultiMonthFinanceReport } from '@/services/financeService';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');
    const partnerId = searchParams.get('partnerId') || undefined;

    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
    
    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    // Handle comma-separated list of months
    let months: number[] = [];
    if (monthStr) {
      months = monthStr
        .split(',')
        .map((m) => parseInt(m.trim(), 10))
        .filter((m) => !isNaN(m) && m >= 1 && m <= 12);
    } else {
      months = [now.getMonth() + 1];
    }

    if (months.length === 0) {
      return NextResponse.json({ error: 'Invalid month parameter' }, { status: 400 });
    }

    if (months.length === 1) {
      const report = await getMonthlyFinanceReport(user.companyId, year, months[0], partnerId);
      return NextResponse.json(report);
    } else {
      const report = await getMultiMonthFinanceReport(user.companyId, year, months, partnerId);
      return NextResponse.json(report);
    }
  } catch (error) {
    console.error('Fetch monthly dashboard error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
