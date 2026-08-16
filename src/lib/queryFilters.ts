import { Prisma } from '@prisma/client';

export interface FilterParams {
  periodType?: 'all' | 'monthly' | 'yearly' | 'custom';
  year?: number;
  month?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  partnerId?: string;
  employeeId?: string;
  projectId?: string;
  paymentSource?: string;
  receivedByPartnerId?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function parseFilterParams(urlStr: string): FilterParams {
  const url = new URL(urlStr);
  const searchParams = url.searchParams;

  const periodType = (searchParams.get('periodType') || 'monthly') as any;
  const yearStr = searchParams.get('year');
  const monthStr = searchParams.get('month');
  
  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;

  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const partnerId = searchParams.get('partnerId') || undefined;
  const employeeId = searchParams.get('employeeId') || undefined;
  const projectId = searchParams.get('projectId') || undefined;
  const paymentSource = searchParams.get('paymentSource') || undefined;
  const receivedByPartnerId = searchParams.get('receivedByPartnerId') || undefined;
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search') || undefined;

  const pageStr = searchParams.get('page');
  const limitStr = searchParams.get('limit');
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const limit = limitStr ? parseInt(limitStr, 10) : 10;

  return {
    periodType,
    year,
    month,
    startDate,
    endDate,
    partnerId,
    employeeId,
    projectId,
    paymentSource,
    receivedByPartnerId,
    category,
    search,
    page,
    limit,
  };
}

export function buildPrismaDateFilter(
  periodType: 'all' | 'monthly' | 'yearly' | 'custom',
  year: number,
  month: number,
  startDate?: string,
  endDate?: string
) {
  if (periodType === 'all') {
    return undefined;
  }

  let start: Date;
  let end: Date;

  if (periodType === 'monthly') {
    start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  } else if (periodType === 'yearly') {
    start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  } else {
    // Custom date range
    if (!startDate || !endDate) {
      return undefined;
    }
    // Parse to start of days in UTC
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    
    start = new Date(Date.UTC(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0));
    end = new Date(Date.UTC(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 0, 0, 0, 0));
  }

  return {
    gte: start,
    lt: end,
  };
}

export function toNumber(decimal: Prisma.Decimal | number | null | undefined): number {
  if (decimal === null || decimal === undefined) return 0;
  if (typeof decimal === 'number') return decimal;
  return decimal.toNumber();
}
