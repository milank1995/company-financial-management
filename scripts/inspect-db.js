const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const salaries = await prisma.employeeSalary.findMany({
    include: { employee: true },
    orderBy: { paymentDate: 'desc' }
  });
  console.log('Salaries count:', salaries.length);
  salaries.forEach(s => {
    console.log(`ID: ${s.id}, Employee: ${s.employee?.name}, Amount: ${s.amount}, PaymentDate: ${s.paymentDate.toISOString().split('T')[0]}, ApplicablePeriod: ${s.applicableMonth}/${s.applicableYear}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
