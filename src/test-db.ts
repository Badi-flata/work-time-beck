import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  console.log('--- Current Users in DB ---');
  for (const u of users) {
    const isMatched = await bcrypt.compare('password123', u.passwordHash);
    console.log(`Email: ${u.email}, Hash: ${u.passwordHash}, Matches "password123": ${isMatched}`);
  }
  await prisma.$disconnect();
}

main();
