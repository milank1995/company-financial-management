import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { SalaryPaymentSource } from '@prisma/client';
import { NextResponse } from 'next/server';

// Robust client-side safe CSV parser handling quotes
export function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const row: string[] = [];
    let insideQuote = false;
    let current = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    
    // Clean outer quotes from cells
    result.push(row.map(cell => cell.replace(/^"|"$/g, '').trim()));
  }
  return result;
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authenticated) return auth.response!;
  const user = auth.user!;

  const url = new URL(req.url);
  const importType = url.searchParams.get('type'); // 'salaries' | 'payments' | 'expenses'

  if (!importType || !['salaries', 'payments', 'expenses'].includes(importType)) {
    return NextResponse.json({ error: 'Invalid or missing import type parameter' }, { status: 400 });
  }

  try {
    const csvText = await req.text();
    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ error: 'Empty file uploaded' }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File must contain a header row and at least one data row' }, { status: 400 });
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dataRows = rows.slice(1);

    // Fetch existing lookup entities for name matching
    const partners = await prisma.partner.findMany({ where: { companyId: user.companyId } });
    const employees = await prisma.employee.findMany({ where: { companyId: user.companyId } });
    const projects = await prisma.project.findMany({ where: { companyId: user.companyId } });

    // Maps for case-insensitive lookup
    const partnerMap = new Map(partners.map(p => [p.name.toLowerCase(), p.id]));
    const employeeMap = new Map(employees.map(e => [e.name.toLowerCase(), e.id]));
    const projectMap = new Map(projects.map(p => [p.name.toLowerCase(), p.id]));

    const validationErrors: string[] = [];
    const parsedRecords: any[] = [];

    // Helper to get index of header
    const getIndex = (headerNames: string[]) => {
      for (const name of headerNames) {
        const idx = headers.indexOf(name.toLowerCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    if (importType === 'salaries') {
      const idxDate = getIndex(['date', 'payment date']);
      const idxEmp = getIndex(['employee', 'employee name', 'staff']);
      const idxAmount = getIndex(['amount', 'salary amount']);
      const idxSource = getIndex(['source', 'payment source']);
      const idxPaidBy = getIndex(['paid by', 'paid by partner']);
      const idxClient = getIndex(['client', 'client name']);
      const idxReceivedBy = getIndex(['received by', 'received by partner']);

      if (idxDate === -1 || idxEmp === -1 || idxAmount === -1 || idxSource === -1) {
        return NextResponse.json({ error: 'Missing headers. Required: Date, Employee Name, Amount, Payment Source' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        const dateVal = row[idxDate];
        const empName = row[idxEmp];
        const amountVal = row[idxAmount];
        const sourceVal = row[idxSource]?.toUpperCase();
        const paidByName = idxPaidBy !== -1 ? row[idxPaidBy] : '';
        const clientName = idxClient !== -1 ? row[idxClient] : '';
        const receivedByName = idxReceivedBy !== -1 ? row[idxReceivedBy] : '';

        // Validation
        if (!dateVal || isNaN(Date.parse(dateVal))) {
          validationErrors.push(`Row ${rowNum}: Invalid Date format ("${dateVal}"). Use YYYY-MM-DD.`);
        }
        
        const empId = employeeMap.get(empName.toLowerCase());
        if (!empName || !empId) {
          validationErrors.push(`Row ${rowNum}: Employee "${empName}" not found in database.`);
        }

        const amount = parseFloat(amountVal.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
          validationErrors.push(`Row ${rowNum}: Invalid amount "${amountVal}". Must be positive number.`);
        }

        if (!sourceVal || !['COMPANY', 'PARTNER', 'CLIENT_DIRECT'].includes(sourceVal)) {
          validationErrors.push(`Row ${rowNum}: Invalid Payment Source "${sourceVal}". Allowed values: COMPANY, PARTNER, CLIENT_DIRECT.`);
        }

        let partnerId: string | null = null;
        if (sourceVal === 'PARTNER') {
          if (!paidByName) {
            validationErrors.push(`Row ${rowNum}: "Paid By Partner" column is required when source is PARTNER.`);
          } else {
            partnerId = partnerMap.get(paidByName.toLowerCase()) || null;
            if (!partnerId) {
              validationErrors.push(`Row ${rowNum}: Partner "${paidByName}" not found in database.`);
            }
          }
        }

        let receivedByPartnerId: string | null = null;
        if (sourceVal === 'CLIENT_DIRECT') {
          if (!clientName) {
            validationErrors.push(`Row ${rowNum}: "Client Name" column is required when source is CLIENT_DIRECT.`);
          }
          if (receivedByName) {
            receivedByPartnerId = partnerMap.get(receivedByName.toLowerCase()) || null;
            if (!receivedByPartnerId) {
              validationErrors.push(`Row ${rowNum}: Partner "${receivedByName}" not found in database.`);
            }
          }
        }

        if (validationErrors.length === 0) {
          parsedRecords.push({
            employeeId: empId,
            amount,
            paymentDate: new Date(dateVal),
            paymentSource: sourceVal as SalaryPaymentSource,
            partnerId,
            clientName: clientName || null,
            receivedByPartnerId,
            companyId: user.companyId,
            createdBy: user.userId,
          });
        }
      });
    }

    if (importType === 'payments') {
      const idxDate = getIndex(['date', 'payment date']);
      const idxProj = getIndex(['project', 'project name']);
      const idxClient = getIndex(['client', 'client name']);
      const idxAmount = getIndex(['amount', 'amount received']);
      const idxReceivedBy = getIndex(['received by', 'received by partner']);

      if (idxDate === -1 || idxProj === -1 || idxAmount === -1 || idxReceivedBy === -1) {
        return NextResponse.json({ error: 'Missing headers. Required: Date, Project Name, Amount, Received By Partner' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        const dateVal = row[idxDate];
        const projName = row[idxProj];
        const clientVal = idxClient !== -1 ? row[idxClient] : '';
        const amountVal = row[idxAmount];
        const receivedByName = row[idxReceivedBy];

        if (!dateVal || isNaN(Date.parse(dateVal))) {
          validationErrors.push(`Row ${rowNum}: Invalid Date "${dateVal}". Use YYYY-MM-DD.`);
        }

        const projectId = projectMap.get(projName.toLowerCase());
        if (!projName || !projectId) {
          validationErrors.push(`Row ${rowNum}: Project "${projName}" not found in database.`);
        }

        const amount = parseFloat(amountVal.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
          validationErrors.push(`Row ${rowNum}: Invalid amount "${amountVal}". Must be positive.`);
        }

        const partnerId = partnerMap.get(receivedByName.toLowerCase());
        if (!receivedByName || !partnerId) {
          validationErrors.push(`Row ${rowNum}: Recipient Partner "${receivedByName}" not found.`);
        }

        if (validationErrors.length === 0) {
          parsedRecords.push({
            projectId,
            amount,
            paymentDate: new Date(dateVal),
            partnerId,
            clientName: clientVal || null,
            companyId: user.companyId,
            createdBy: user.userId,
          });
        }
      });
    }

    if (importType === 'expenses') {
      const idxDate = getIndex(['date', 'expense date']);
      const idxDesc = getIndex(['description', 'details']);
      const idxCat = getIndex(['category', 'expense category']);
      const idxAmount = getIndex(['amount']);
      const idxPaidBy = getIndex(['paid by', 'paid by partner']);

      if (idxDate === -1 || idxDesc === -1 || idxCat === -1 || idxAmount === -1 || idxPaidBy === -1) {
        return NextResponse.json({ error: 'Missing headers. Required: Date, Description, Category, Amount, Paid By Partner' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const rowNum = index + 2;
        const dateVal = row[idxDate];
        const descVal = row[idxDesc];
        const catVal = row[idxCat];
        const amountVal = row[idxAmount];
        const paidByName = row[idxPaidBy];

        if (!dateVal || isNaN(Date.parse(dateVal))) {
          validationErrors.push(`Row ${rowNum}: Invalid Date "${dateVal}". Use YYYY-MM-DD.`);
        }

        if (!descVal) {
          validationErrors.push(`Row ${rowNum}: Description is required.`);
        }

        if (!catVal) {
          validationErrors.push(`Row ${rowNum}: Category is required.`);
        }

        const amount = parseFloat(amountVal.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
          validationErrors.push(`Row ${rowNum}: Invalid amount "${amountVal}".`);
        }

        const partnerId = partnerMap.get(paidByName.toLowerCase());
        if (!paidByName || !partnerId) {
          validationErrors.push(`Row ${rowNum}: Paid By Partner "${paidByName}" not found.`);
        }

        if (validationErrors.length === 0) {
          parsedRecords.push({
            description: descVal,
            category: catVal,
            amount,
            expenseDate: new Date(dateVal),
            partnerId,
            companyId: user.companyId,
            createdBy: user.userId,
          });
        }
      });
    }

    // Stop execution and return if validation errors exist
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Validation Failed', details: validationErrors }, { status: 400 });
    }

    // Write all records in a single Prisma transaction for safety
    await prisma.$transaction(async (tx) => {
      if (importType === 'salaries') {
        for (const record of parsedRecords) {
          await tx.employeeSalary.create({ data: record });
        }
      } else if (importType === 'payments') {
        for (const record of parsedRecords) {
          await tx.projectPayment.create({ data: record });
        }
      } else if (importType === 'expenses') {
        for (const record of parsedRecords) {
          await tx.companyExpense.create({ data: record });
        }
      }
    });

    return NextResponse.json({ success: true, count: parsedRecords.length });
  } catch (error: any) {
    console.error('Import CSV error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
