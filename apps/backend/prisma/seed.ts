import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** Demo treasury wallet (public figure address — replace via SEED_TREASURY_ADDRESS). */
const DEFAULT_TREASURY_ADDRESS =
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function main(): Promise<void> {
  const address =
    process.env.SEED_TREASURY_ADDRESS ?? DEFAULT_TREASURY_ADDRESS;

  let treasury = await prisma.treasury.findFirst({
    where: { address },
  });

  if (!treasury) {
    treasury = await prisma.treasury.create({
      data: {
        name: 'Demo DAO Treasury',
        address,
        chainId: 1,
        orgId: process.env.SEED_ORG_ID ?? 'seed-demo-org',
      },
    });
    console.log(`Created treasury ${treasury.id} (${treasury.name})`);
  } else {
    console.log(`Using existing treasury ${treasury.id} (${treasury.name})`);
  }

  await prisma.tokenBalance.deleteMany({
    where: { treasuryId: treasury.id },
  });

  const now = new Date();
  const samples: Prisma.TokenBalanceCreateManyInput[] = [
    {
      treasuryId: treasury.id,
      chainId: 1n,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
      balance: 5_000_000_000n,
      balanceUSD: new Prisma.Decimal('5000.00'),
      priceUSD: new Prisma.Decimal('1.00'),
      lastUpdated: now,
    },
    {
      treasuryId: treasury.id,
      chainId: 8453n,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
      balance: 2_500_000_000n,
      balanceUSD: new Prisma.Decimal('2500.00'),
      priceUSD: new Prisma.Decimal('1.00'),
      lastUpdated: now,
    },
    {
      treasuryId: treasury.id,
      chainId: 1n,
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      decimals: 18,
      balance: (BigInt(25) * 10n ** 16n) as bigint,
      balanceUSD: new Prisma.Decimal('87500.00'),
      priceUSD: new Prisma.Decimal('3500.00'),
      lastUpdated: now,
    },
  ];

  await prisma.tokenBalance.createMany({ data: samples });
  console.log(`Seeded ${samples.length} token balance row(s) for treasury ${treasury.id}`);

  const govCount = await prisma.governanceProposal.count();
  if (govCount === 0) {
    const start = new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.governanceProposal.create({
      data: {
        id: 'seed-demo-proposal-1',
        snapshotId: '0',
        title: '[SEED] Allocate runway for Q3 operations',
        body: 'Seed proposal for local testing. Vote choices are illustrative.',
        status: 'active',
        space: 'demo.eth',
        author: '0x0000000000000000000000000000000000000001',
        choices: ['For', 'Against', 'Abstain'],
        scores: [12.5, 3.2, 1.0],
        start,
        end,
        votes: { total: 42 },
        aiSummary: null,
      },
    });
    console.log('Seeded one demo GovernanceProposal (no Snapshot sync required)');
  } else {
    console.log(
      `Skipping governance seed (${govCount} proposal(s) already in DB)`,
    );
  }

  console.log('');
  console.log('Next: POST /ai/analyze/' + treasury.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
