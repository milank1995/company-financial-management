import { checkAuth } from '@/lib/auth';
import { getMonthlyFinanceReport } from '@/services/financeService';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    // Default to current year and month if not provided
    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month parameter' }, { status: 400 });
    }

    const report = await getMonthlyFinanceReport(user.companyId, year, month);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Fetch monthly dashboard error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
