import { checkAuth } from '@/lib/auth';
import { getMonthlyFinanceReport, getMultiMonthFinanceReport } from '@/services/financeService';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const periodsParam = searchParams.get('periods');
    const partnerId = searchParams.get('partnerId') || undefined;

    let periods: { year: number; month: number }[] = [];

    if (periodsParam) {
      periods = periodsParam
        .split(',')
        .map((p) => {
          const parts = p.trim().split('-');
          return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10),
          };
        })
        .filter((p) => !isNaN(p.year) && !isNaN(p.month) && p.month >= 1 && p.month <= 12);
    } else {
      const yearStr = searchParams.get('year');
      const monthStr = searchParams.get('month');
      const now = new Date();
      const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

      if (isNaN(year)) {
        return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
      }

      let months: number[] = [];
      if (monthStr) {
        months = monthStr
          .split(',')
          .map((m) => parseInt(m.trim(), 10))
          .filter((m) => !isNaN(m) && m >= 1 && m <= 12);
      } else {
        months = [now.getMonth() + 1];
      }

      periods = months.map((m) => ({ year, month: m }));
    }

    if (periods.length === 0) {
      return NextResponse.json({ error: 'No valid periods specified' }, { status: 400 });
    }

    if (periods.length === 1) {
      const report = await getMonthlyFinanceReport(user.companyId, periods[0].year, periods[0].month, partnerId);
      return NextResponse.json(report);
    } else {
      const report = await getMultiMonthFinanceReport(user.companyId, periods, partnerId);
      return NextResponse.json(report);
    }
  } catch (error) {
    console.error('Fetch monthly dashboard error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
