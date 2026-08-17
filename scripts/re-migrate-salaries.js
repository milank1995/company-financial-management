const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting data correction migration for salaries period alignment...');
  
  const salaries = await prisma.employeeSalary.findMany({
    where: { deletedAt: null }
  });

  console.log(`Found ${salaries.length} salaries to process.`);

  let updatedCount = 0;

  for (const salary of salaries) {
    const paymentDate = new Date(salary.paymentDate);
    
    // Resolve work month: the month before the actual cashflow execution date
    let targetMonth = paymentDate.getMonth(); // getMonth() returns 0-11, which is month-1!
    let targetYear = paymentDate.getFullYear();

    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }

    // Only update if it is different
    if (salary.applicableMonth !== targetMonth || salary.applicableYear !== targetYear) {
      await prisma.employeeSalary.update({
        where: { id: salary.id },
        data: {
          applicableMonth: targetMonth,
          applicableYear: targetYear
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} salaries to represent their correct work month periods!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
