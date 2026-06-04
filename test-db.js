const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('DB Connection: SUCCESS');
    await prisma.$disconnect();
  } catch(e) {
    console.error('DB Connection: FAILED', e.message);
  }
}
main();
