const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.employeeSalary.findUnique({
    where: { id: '5e24225d-9156-4116-8d45-b8a12de73ed4' }
  });
  console.log('paymentDate raw:', s.paymentDate);
  const paymentDate = new Date(s.paymentDate);
  console.log('paymentDate.getMonth() in UTC:', paymentDate.getUTCMonth() + 1);
  console.log('paymentDate.getMonth() in local:', paymentDate.getMonth() + 1);
  console.log('applicableMonth:', s.applicableMonth);
}

main().catch(console.error).finally(() => prisma.$disconnect());
