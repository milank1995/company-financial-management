import { checkAuth } from '@/lib/auth';
import { getYearlyFinanceReport } from '@/services/financeService';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  try {
    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    const partnerId = searchParams.get('partnerId') || undefined;

    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const report = await getYearlyFinanceReport(user.companyId, year, partnerId);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Fetch yearly dashboard error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
