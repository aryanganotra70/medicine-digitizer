import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Add SSL parameters to DATABASE_URL if not present (for Railway/production)
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && process.env.NODE_ENV === 'production' && !databaseUrl.includes('sslmode')) {
  databaseUrl += databaseUrl.includes('?') ? '&' : '?';
  databaseUrl += 'sslmode=require';
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
