import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Accounting Period backfill migration...');

  // 1. ProjectPayments
  const payments = await prisma.projectPayment.findMany();
  console.log(`Found ${payments.length} project payments.`);
  for (const p of payments) {
    const month = p.paymentDate.getMonth() + 1;
    const year = p.paymentDate.getFullYear();
    await prisma.projectPayment.update({
      where: { id: p.id },
      data: { applicableMonth: month, applicableYear: year },
    });
  }

  // 2. EmployeeSalaries
  const salaries = await prisma.employeeSalary.findMany();
  console.log(`Found ${salaries.length} employee salaries.`);
  for (const s of salaries) {
    const month = s.paymentDate.getMonth() + 1;
    const year = s.paymentDate.getFullYear();
    await prisma.employeeSalary.update({
      where: { id: s.id },
      data: { applicableMonth: month, applicableYear: year },
    });
  }

  // 3. CompanyExpenses
  const expenses = await prisma.companyExpense.findMany();
  console.log(`Found ${expenses.length} company expenses.`);
  for (const e of expenses) {
    const month = e.expenseDate.getMonth() + 1;
    const year = e.expenseDate.getFullYear();
    await prisma.companyExpense.update({
      where: { id: e.id },
      data: { applicableMonth: month, applicableYear: year },
    });
  }

  // 4. PartnerAdjustments
  const adjustments = await prisma.partnerAdjustment.findMany();
  console.log(`Found ${adjustments.length} partner adjustments.`);
  for (const a of adjustments) {
    const month = a.adjustmentDate.getMonth() + 1;
    const year = a.adjustmentDate.getFullYear();
    await prisma.partnerAdjustment.update({
      where: { id: a.id },
      data: { applicableMonth: month, applicableYear: year },
    });
  }

  console.log('Accounting Period migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
