import { prisma } from '../lib/prisma';
import { SalaryPaymentSource } from '@prisma/client';
import {
  getMonthlyFinanceReport,
  getYearlyFinanceReport,
  validateOwnershipSetup,
} from '../services/financeService';

async function setupTestData() {
  console.log('--- Cleaning Database for Test ---');
  await prisma.projectPayment.deleteMany();
  await prisma.employeeSalary.deleteMany();
  await prisma.companyExpense.deleteMany();
  await prisma.partnerAdjustment.deleteMany();
  await prisma.partnerOwnership.deleteMany();
  await prisma.ownershipSetup.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log('--- Seeding Test Company ---');
  const company = await prisma.company.create({
    data: { name: 'Test Company Corp' },
  });

  const companyId = company.id;

  console.log('--- Seeding Partners ---');
  const partnerA = await prisma.partner.create({
    data: { name: 'Partner A', companyId },
  });
  const partnerB = await prisma.partner.create({
    data: { name: 'Partner B', companyId },
  });
  const partnerC = await prisma.partner.create({
    data: { name: 'Partner C', companyId },
  });

  console.log('--- Seeding Projects and Employees ---');
  const project1 = await prisma.project.create({
    data: { name: 'Project Alpha', totalAmount: 100000.00, companyId },
  });
  const employee1 = await prisma.employee.create({
    data: { name: 'Alice Smith', role: 'Developer', companyId },
  });

  return {
    companyId,
    partnerAId: partnerA.id,
    partnerBId: partnerB.id,
    partnerCId: partnerC.id,
    projectId: project1.id,
    employeeId: employee1.id,
  };
}

async function runTests() {
  const context = await setupTestData();
  const { companyId, partnerAId, partnerBId, partnerCId, projectId, employeeId } = context;

  console.log('--- Test Scenario 1: Ownership Setups validation ---');
  const setup1 = await prisma.ownershipSetup.create({
    data: {
      companyId,
      effectiveDate: new Date(Date.UTC(2026, 0, 1)), // Jan 1, 2026
      partnerOwnerships: {
        create: [
          { partnerId: partnerAId, percentage: 0.5000 },
          { partnerId: partnerBId, percentage: 0.5000 },
          { partnerId: partnerCId, percentage: 0.0000 },
        ],
      },
    },
  });
  const isValid1 = await validateOwnershipSetup(setup1.id);
  console.assert(isValid1 === true, 'Setup 1 should be valid (50 + 50 = 100)');

  const setup2 = await prisma.ownershipSetup.create({
    data: {
      companyId,
      effectiveDate: new Date(Date.UTC(2026, 1, 1)), // Feb 1, 2026
      partnerOwnerships: {
        create: [
          { partnerId: partnerAId, percentage: 0.3000 },
          { partnerId: partnerBId, percentage: 0.3000 },
          { partnerId: partnerCId, percentage: 0.3000 },
        ],
      },
    },
  });
  const isValid2 = await validateOwnershipSetup(setup2.id);
  console.assert(isValid2 === false, 'Setup 2 should be invalid (Total 90%)');

  await prisma.partnerOwnership.updateMany({
    where: { setupId: setup2.id, partnerId: partnerAId },
    data: { percentage: 0.4000 },
  });
  const isValid2Corrected = await validateOwnershipSetup(setup2.id);
  console.assert(isValid2Corrected === true, 'Setup 2 Corrected should be valid (40 + 30 + 30 = 100)');

  console.log('--- Test Scenario 2: Monthly Isolation and Profit Distribution ---');
  // Income: $10,000 received by Partner A on Jan 15
  const paymentJan = await prisma.projectPayment.create({
    data: {
      companyId,
      projectId,
      amount: 10000.00,
      paymentDate: new Date(Date.UTC(2026, 0, 15)),
      partnerId: partnerAId,
    },
  });

  // Salary: $3,000 paid by Partner B on Jan 20 (PARTNER source)
  await prisma.employeeSalary.create({
    data: {
      companyId,
      employeeId,
      amount: 3000.00,
      paymentDate: new Date(Date.UTC(2026, 0, 20)),
      paymentSource: SalaryPaymentSource.PARTNER,
      partnerId: partnerBId,
    },
  });

  // Expense: $1,000 paid by Partner A on Jan 22
  const expenseJan = await prisma.companyExpense.create({
    data: {
      companyId,
      amount: 1000.00,
      category: 'Software',
      expenseDate: new Date(Date.UTC(2026, 0, 22)),
      description: 'Prisma Cloud',
      partnerId: partnerAId,
    },
  });

  // Fetch Report for January (Month 1)
  // Total Income = 10,000
  // Total Salary = 3,000
  // Total Expense = 1,000
  // Net Profit = 10000 - 3000 - 1000 = 6,000
  const reportJan = await getMonthlyFinanceReport(companyId, 2026, 1);
  console.assert(reportJan.totalIncome === 10000, `Jan Income expected 10000, got ${reportJan.totalIncome}`);
  console.assert(reportJan.totalSalaries === 3000, `Jan Salaries expected 3000, got ${reportJan.totalSalaries}`);
  console.assert(reportJan.totalExpenses === 1000, `Jan Expenses expected 1000, got ${reportJan.totalExpenses}`);
  console.assert(reportJan.netProfit === 6000, `Jan Net Profit expected 6000, got ${reportJan.netProfit}`);
  console.assert(reportJan.paidByPartners === 3000, `Jan Paid by Partners expected 3000, got ${reportJan.paidByPartners}`);
  console.assert(reportJan.paidByCompany === 0, `Jan Paid by Company expected 0, got ${reportJan.paidByCompany}`);

  const psA_Jan = reportJan.partnerSettlements.find(p => p.partnerId === partnerAId)!;
  console.assert(psA_Jan.profitShare === 3000, `Partner A profit share expected 3000, got ${psA_Jan.profitShare}`);
  console.assert(psA_Jan.companyMoneyReceived === 10000, `Partner A money received expected 10000, got ${psA_Jan.companyMoneyReceived}`);
  console.assert(psA_Jan.netBalance === -6000, `Partner A balance expected -6000, got ${psA_Jan.netBalance}`);

  const psB_Jan = reportJan.partnerSettlements.find(p => p.partnerId === partnerBId)!;
  console.assert(psB_Jan.profitShare === 3000, `Partner B profit share expected 3000, got ${psB_Jan.profitShare}`);
  console.assert(psB_Jan.salariesPaid === 3000, `Partner B salaries paid expected 3000, got ${psB_Jan.salariesPaid}`);
  console.assert(psB_Jan.netBalance === 6000, `Partner B balance expected 6000, got ${psB_Jan.netBalance}`);

  console.log('--- Test Scenario 3: Salary payment sources (COMPANY and CLIENT_DIRECT) ---');
  // Create salary in February:
  // 1. COMPANY source: $2,000
  await prisma.employeeSalary.create({
    data: {
      companyId,
      employeeId,
      amount: 2000.00,
      paymentDate: new Date(Date.UTC(2026, 1, 5)), // Feb 5
      paymentSource: SalaryPaymentSource.COMPANY,
    },
  });

  // 2. CLIENT_DIRECT source (paid to partner C's account): $1,500
  await prisma.employeeSalary.create({
    data: {
      companyId,
      employeeId,
      amount: 1500.00,
      paymentDate: new Date(Date.UTC(2026, 1, 12)), // Feb 12
      paymentSource: SalaryPaymentSource.CLIENT_DIRECT,
      clientName: 'Google',
      receivedByPartnerId: partnerCId,
    },
  });

  // 3. CLIENT_DIRECT source (paid directly to employee, not holding company funds): $1,000
  await prisma.employeeSalary.create({
    data: {
      companyId,
      employeeId,
      amount: 1000.00,
      paymentDate: new Date(Date.UTC(2026, 1, 15)), // Feb 15
      paymentSource: SalaryPaymentSource.CLIENT_DIRECT,
      clientName: 'Meta',
      receivedByPartnerId: null, // directly to employee
    },
  });

  // Total Feb Income: $20,000 received by Partner C
  await prisma.projectPayment.create({
    data: {
      companyId,
      projectId,
      amount: 20000.00,
      paymentDate: new Date(Date.UTC(2026, 1, 10)),
      partnerId: partnerCId,
    },
  });

  // February Calculations:
  // Income: 20,000
  // Salaries: 2000 (COMPANY) + 1500 (CLIENT_DIRECT) + 1000 (CLIENT_DIRECT) = 4500
  // Expenses: 0
  // Net Profit: 20000 - 4500 = 15500
  // Ownership (Feb Setup 2): A: 40%, B: 30%, C: 30%
  // Partner C Profit Share = 15500 * 0.3 = 4650
  // Partner C Company Money Received = 20,000 (project payment)
  // Partner C Client Direct Salary Received = 1,500
  // Partner C Total Company Money Received = 20000 + 1500 = 21500
  // Partner C Net Balance = 4650 (profit) - 21500 (money received) = -16850
  const reportFeb = await getMonthlyFinanceReport(companyId, 2026, 2);
  console.assert(reportFeb.totalSalaries === 4500, `Feb Salaries expected 4500, got ${reportFeb.totalSalaries}`);
  console.assert(reportFeb.paidByCompany === 2000, `Feb Paid by Company expected 2000, got ${reportFeb.paidByCompany}`);
  console.assert(reportFeb.paidDirectlyByClients === 2500, `Feb Paid Directly by Clients expected 2500, got ${reportFeb.paidDirectlyByClients}`);
  console.assert(reportFeb.netProfit === 15500, `Feb Net Profit expected 15500, got ${reportFeb.netProfit}`);

  const psC_Feb = reportFeb.partnerSettlements.find(p => p.partnerId === partnerCId)!;
  console.assert(psC_Feb.profitShare === 4650, `Partner C Feb profit share expected 4650, got ${psC_Feb.profitShare}`);
  console.assert(psC_Feb.clientDirectSalaryReceived === 1500, `Partner C Client Direct Received expected 1500, got ${psC_Feb.clientDirectSalaryReceived}`);
  console.assert(psC_Feb.totalCompanyMoneyReceived === 21500, `Partner C Total Company Received expected 21500, got ${psC_Feb.totalCompanyMoneyReceived}`);
  console.assert(psC_Feb.netBalance === -16850, `Partner C Feb Net Balance expected -16850, got ${psC_Feb.netBalance}`);

  // Partner A Feb check:
  // Profit Share = 15500 * 0.4 = 6200. Net Balance = 6200.
  const psA_Feb = reportFeb.partnerSettlements.find(p => p.partnerId === partnerAId)!;
  console.assert(psA_Feb.netBalance === 6200, `Partner A Feb Net Balance expected 6200, got ${psA_Feb.netBalance}`);

  console.log('--- Test Scenario 4: Editing and Soft-deleting transactions ---');
  // Edit AWS/Software expense
  await prisma.companyExpense.update({
    where: { id: expenseJan.id },
    data: { amount: 1500.00 },
  });

  const reportJanEdited = await getMonthlyFinanceReport(companyId, 2026, 1);
  console.assert(reportJanEdited.netProfit === 5500, `Jan Net Profit after edit expected 5500, got ${reportJanEdited.netProfit}`);

  // Soft-delete January project payment
  await prisma.projectPayment.update({
    where: { id: paymentJan.id },
    data: { deletedAt: new Date(), deletedBy: 'test-user' },
  });

  // January now: Income = 0, Salaries = 3000, Expenses = 1500, Net Profit = -4500
  const reportJanDeleted = await getMonthlyFinanceReport(companyId, 2026, 1);
  console.assert(reportJanDeleted.netProfit === -4500, `Jan Net Profit after soft-delete expected -4500, got ${reportJanDeleted.netProfit}`);

  console.log('--- Test Scenario 5: Yearly Aggregation ---');
  // Yearly Income = 20,000 (from Feb)
  // Yearly Salaries = 3,000 (Jan) + 4,500 (Feb) = 7,500
  // Yearly Expenses = 1,500 (Jan)
  // Net Profit = 20000 - 7500 - 1500 = 11,000
  // Partner A Profit Share:
  // Jan: -4500 * 0.5 = -2250
  // Feb: 15500 * 0.4 = 6200
  // Total Profit Share = -2250 + 6200 = 3950
  const yearlyReport = await getYearlyFinanceReport(companyId, 2026);
  console.assert(yearlyReport.totalIncome === 20000, `Yearly Income expected 20000, got ${yearlyReport.totalIncome}`);
  console.assert(yearlyReport.totalSalaries === 7500, `Yearly Salaries expected 7500, got ${yearlyReport.totalSalaries}`);
  console.assert(yearlyReport.netProfit === 11000, `Yearly Net Profit expected 11000, got ${yearlyReport.netProfit}`);
  console.assert(yearlyReport.paidByCompany === 2000, `Yearly Paid by Company expected 2000, got ${yearlyReport.paidByCompany}`);

  const yA = yearlyReport.partnerSettlements.find(p => p.partnerId === partnerAId)!;
  console.assert(yA.profitShare === 3950, `Yearly Partner A Profit Share expected 3950, got ${yA.profitShare}`);

  console.log('--- ALL AUTOMATED TESTS COMPLETED ---');
}

runTests()
  .catch((err) => {
    console.error('Test script failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
