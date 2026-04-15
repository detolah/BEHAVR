const prisma = require('../src/lib/prisma');

afterAll(async () => {
  await prisma.$disconnect();
});
