const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.importAnomaly.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Users
  const aisha = await prisma.user.create({
    data: {
      email: 'aisha@example.com',
      name: 'Aisha',
      passwordHash,
    },
  });

  const rohan = await prisma.user.create({
    data: {
      email: 'rohan@example.com',
      name: 'Rohan',
      passwordHash,
    },
  });

  const priya = await prisma.user.create({
    data: {
      email: 'priya@example.com',
      name: 'Priya',
      passwordHash,
    },
  });

  const meera = await prisma.user.create({
    data: {
      email: 'meera@example.com',
      name: 'Meera',
      passwordHash,
    },
  });

  const dev = await prisma.user.create({
    data: {
      email: 'dev@example.com',
      name: 'Dev',
      passwordHash,
    },
  });

  const sam = await prisma.user.create({
    data: {
      email: 'sam@example.com',
      name: 'Sam',
      passwordHash,
    },
  });

  console.log('Users created.');

  // Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Flat Shared Expenses',
      description: 'Shared expenses tracker for the flat mates and trips.',
      defaultCurrency: 'INR',
    },
  });

  console.log('Group created.');

  // Create Group Memberships based on timeline
  // February is month 1 (0-indexed: 1 for Feb)
  // Meera left end of March: leftAt = Mar 31, 2026
  // Sam joined mid-April: joinedAt = Apr 15, 2026
  // Aisha, Rohan, Priya: joined Feb 1, 2026
  // Dev: joined Feb 1, 2026, left May 31, 2026 (for trip support)

  await prisma.groupMembership.createMany({
    data: [
      {
        groupId: group.id,
        userId: aisha.id,
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        role: 'member',
      },
      {
        groupId: group.id,
        userId: rohan.id,
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        role: 'member',
      },
      {
        groupId: group.id,
        userId: priya.id,
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        role: 'member',
      },
      {
        groupId: group.id,
        userId: meera.id,
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        leftAt: new Date('2026-03-31T23:59:59Z'),
        role: 'member',
      },
      {
        groupId: group.id,
        userId: dev.id,
        joinedAt: new Date('2026-02-01T00:00:00Z'),
        leftAt: new Date('2026-05-31T23:59:59Z'),
        role: 'member',
      },
      {
        groupId: group.id,
        userId: sam.id,
        joinedAt: new Date('2026-04-15T00:00:00Z'),
        role: 'member',
      },
    ],
  });

  console.log('Memberships seeded.');
  console.log(`Group ID: ${group.id}`);
  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
